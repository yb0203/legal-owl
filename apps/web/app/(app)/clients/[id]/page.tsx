import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, User, TriangleAlert, ChevronRight, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  CLIENT_STATUS_LABELS,
  FORUM_LABELS,
  type Client,
  type Contact,
  type Engagement,
  type ForumType,
} from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { HearingPill } from "@/components/badges";
import { SectionCard, EmptyState } from "@/components/page-header";
import { PageShell, SectionHeading, List, ListRow, Callout, Tag, BackLink } from "@/components/layout";
import { PropertiesRail, type PropertyRow } from "@/components/record/properties-rail";
import { AttributeValue } from "@/components/record/attribute-value";
import { RuleHint } from "@/components/record/rule-hint";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addContact, dismissConflict } from "./actions";

const CLIENT_TYPE_DOMAIN = ["Individual", "Organisation"] as const;
const CLIENT_STATUS_DOMAIN = Object.values(CLIENT_STATUS_LABELS);

interface MatterLite {
  id: string;
  key: string;
  title: string;
  forum_type: ForumType;
  next_hearing_date: string | null;
}
interface ConflictFlag {
  id: string;
  matched_name: string;
  note: string | null;
  matter_id: string | null;
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, type, display_name, status, email, phone, address, gstin, pan, notes, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!clientRow) notFound();
  const client = clientRow as Client;

  const [{ data: contacts }, { data: engagements }, { data: matters }, { data: flags }] =
    await Promise.all([
      supabase.from("contacts").select("id, client_id, name, role, email, phone").eq("client_id", id).returns<Contact[]>(),
      supabase.from("engagements").select("id, client_id, name, scope_note, status, created_at").eq("client_id", id).returns<Engagement[]>(),
      supabase.from("matters").select("id, key, title, forum_type, next_hearing_date").eq("client_id", id).order("next_hearing_date", { ascending: true, nullsFirst: false }).returns<MatterLite[]>(),
      supabase.from("conflict_flags").select("id, matched_name, note, matter_id").eq("client_id", id).eq("status", "open").returns<ConflictFlag[]>(),
    ]);

  const isOrg = client.type === "organisation";
  const matterCount = matters?.length ?? 0;
  const engagementCount = engagements?.length ?? 0;
  const contactCount = contacts?.length ?? 0;

  const detailRows: PropertyRow[] = [
    {
      label: "Type",
      value: (
        <AttributeValue
          value={isOrg ? "Organisation" : "Individual"}
          domain={CLIENT_TYPE_DOMAIN}
        />
      ),
    },
    {
      label: "Status",
      value: <AttributeValue value={CLIENT_STATUS_LABELS[client.status]} domain={CLIENT_STATUS_DOMAIN} />,
    },
    { label: "Email", value: client.email },
    { label: "Phone", value: client.phone },
    { label: "Address", value: client.address },
    // GSTIN / PAN are organisation-only — omit entirely for individuals.
    ...(isOrg
      ? [
          { label: "GSTIN", value: client.gstin ? <span className="font-mono tnum">{client.gstin}</span> : null },
          { label: "PAN", value: client.pan ? <span className="font-mono tnum">{client.pan}</span> : null },
        ]
      : []),
    { label: "Engagements", value: String(engagementCount) },
    { label: "Matters", value: String(matterCount) },
    { label: "Contacts", value: String(contactCount) },
    { label: "Created", value: fmtDate(client.created_at) },
  ];

  return (
    <PageShell>
      <BackLink href="/clients">Clients</BackLink>

      <header className="mt-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {client.type === "organisation" ? (
            <Building2 className="size-7 text-muted-foreground" />
          ) : (
            <User className="size-7 text-muted-foreground" />
          )}
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">{client.display_name}</h1>
            <p className="text-sm text-muted-foreground">
              {CLIENT_STATUS_LABELS[client.status]}
              {client.email ? ` · ${client.email}` : ""}
              {client.phone ? ` · ${client.phone}` : ""}
            </p>
          </div>
        </div>
        <Link href={`/matters/new?client=${client.id}`} className={buttonVariants({ size: "sm" })}>
          + New matter
        </Link>
      </header>

      {(flags?.length ?? 0) === 0 && (
        <Callout tone="primary" className="mt-6 flex items-center gap-2 px-4 py-2.5 text-sm">
          <ShieldCheck className="size-4" />
          No conflicts found
        </Callout>
      )}

      {(flags?.length ?? 0) > 0 && (
        <Callout tone="urgent" className="mt-6 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-urgent">
            <TriangleAlert className="size-4" />
            Possible conflict of interest
          </div>
          <ul className="mt-2 space-y-2">
            {flags!.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {f.note ?? `Matches “${f.matched_name}”`}
                  {f.matter_id && (
                    <Link href={`/matters/${f.matter_id}`} className="ml-2 underline underline-offset-2">
                      view matter
                    </Link>
                  )}
                </span>
                <form action={dismissConflict}>
                  <input type="hidden" name="flag_id" value={f.id} />
                  <input type="hidden" name="client_id" value={client.id} />
                  <Button type="submit" size="sm" variant="outline">Acknowledge</Button>
                </form>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="mt-6 space-y-6">
        <SectionCard title="Properties">
          <div className="px-4 py-1">
            <PropertiesRail items={detailRows} />
          </div>
        </SectionCard>

        <section>
          <SectionHeading className="mb-2">Matters ({matterCount})</SectionHeading>
          {matterCount === 0 ? (
            <EmptyState title="No matters yet" />
          ) : (
            <List>
              {matters!.map((m) => (
                <ListRow
                  key={m.id}
                  href={`/matters/${m.id}`}
                  title={m.title}
                  subtitle={
                    <>
                      {FORUM_LABELS[m.forum_type]} · <span className="font-mono tnum">{m.key}</span>
                    </>
                  }
                  trailing={
                    <>
                      {m.next_hearing_date ? <HearingPill date={m.next_hearing_date} /> : <span className="text-sm text-muted-foreground">—</span>}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </>
                  }
                />
              ))}
            </List>
          )}
        </section>

        {engagementCount > 0 && (
          <section>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <SectionHeading className="mb-0">Engagements ({engagementCount})</SectionHeading>
              <RuleHint>A &ldquo;General&rdquo; engagement is auto-created per client.</RuleHint>
            </div>
            <List>
              {engagements!.map((e) => (
                <ListRow key={e.id} className="justify-between text-sm">
                  <span className="font-medium">{e.name}</span>
                  <Tag className="capitalize">{e.status.replace("_", " ")}</Tag>
                </ListRow>
              ))}
            </List>
          </section>
        )}

        <SectionCard title={`Contacts (${contactCount})`}>
          <ul className="divide-y">
            {contactCount === 0 && (
              <li className="px-4 py-4 text-center text-sm text-muted-foreground">No contacts yet.</li>
            )}
            {contacts!.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{c.name}</span>
                  {c.role && <span className="ml-2 text-muted-foreground">{c.role}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{c.email || c.phone}</span>
              </li>
            ))}
          </ul>
          <form action={addContact} className="flex flex-wrap items-center gap-2 border-t p-2.5">
            <input type="hidden" name="client_id" value={client.id} />
            <Input name="name" required placeholder="Name" className="h-8 min-w-32 flex-1" />
            <Input name="role" placeholder="Role" className="h-8 w-28" />
            <Input name="phone" placeholder="Phone" className="h-8 w-32" />
            <Button type="submit" size="sm">Add</Button>
          </form>
        </SectionCard>

        {client.notes && (
          <section>
            <SectionHeading className="mb-2">Notes</SectionHeading>
            <p className="rounded-xl border bg-card p-4 text-sm whitespace-pre-wrap">{client.notes}</p>
          </section>
        )}
      </div>
    </PageShell>
  );
}
