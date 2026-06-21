import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, User, TriangleAlert, ChevronRight } from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addContact, dismissConflict } from "./actions";

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

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Clients
      </Link>

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

      {(flags?.length ?? 0) > 0 && (
        <div className="mt-6 rounded-xl border border-urgent/40 bg-urgent/10 p-4">
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
        </div>
      )}

      <div className="mt-6 space-y-6">
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Matters</h2>
          {(matters?.length ?? 0) === 0 ? (
            <EmptyState title="No matters yet" />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border">
              {matters!.map((m) => (
                <li key={m.id}>
                  <Link href={`/matters/${m.id}`} className="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-accent/40">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{m.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {FORUM_LABELS[m.forum_type]} · <span className="font-mono tnum">{m.key}</span>
                      </div>
                    </div>
                    {m.next_hearing_date ? <HearingPill date={m.next_hearing_date} /> : <span className="text-sm text-muted-foreground">—</span>}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(engagements?.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Engagements</h2>
            <ul className="divide-y overflow-hidden rounded-xl border">
              {engagements!.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 bg-card px-4 py-3 text-sm">
                  <span className="font-medium">{e.name}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] capitalize text-secondary-foreground">{e.status.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <SectionCard title="Contacts">
          <ul className="divide-y">
            {(contacts?.length ?? 0) === 0 && (
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
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Notes</h2>
            <p className="rounded-xl border bg-card p-4 text-sm whitespace-pre-wrap">{client.notes}</p>
          </section>
        )}
      </div>
    </main>
  );
}
