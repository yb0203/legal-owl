import Link from "next/link";
import { ChevronRight, Scale, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState } from "@/components/page-header";
import { HearingPill, MatterStatusBadge } from "@/components/badges";
import { LabelChip } from "@/components/label-chip";
import { HelpLink } from "@/components/help/help-link";
import { FORUM_LABELS, type ForumType, type Label, type MatterStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MatterRow {
  id: string;
  key: string;
  title: string;
  forum_type: ForumType;
  matter_status: MatterStatus;
  next_hearing_date: string | null;
  client: { display_name: string } | null;
}

const TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "disposed", label: "Disposed" },
  { value: "archived", label: "Archived" },
] as const;

export default async function MattersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; label?: string }>;
}) {
  const { q = "", status = "all", label = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("matters")
    .select("id, key, title, forum_type, matter_status, next_hearing_date, client:clients(display_name)")
    .order("next_hearing_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (status === "archived") query = query.not("archived_at", "is", null);
  else {
    query = query.is("archived_at", null);
    if (status === "active" || status === "on_hold" || status === "disposed") {
      query = query.eq("matter_status", status);
    }
  }
  if (q.trim()) query = query.or(`title.ilike.%${q}%,key.ilike.%${q}%,cnr.ilike.%${q}%`);

  const { data: rows } = await query.returns<MatterRow[]>();
  let matters = rows ?? [];

  // Labels: the filter-chip row + per-matter chips. Assignments are joined
  // post-fetch (small data; mirrors the post-fetch style already in this file).
  const [{ data: labelRows }, { data: assignmentRows }] = await Promise.all([
    supabase.from("labels").select("id, name, color").order("name").returns<Label[]>(),
    supabase.from("matter_labels").select("matter_id, label_id").returns<{ matter_id: string; label_id: string }[]>(),
  ]);
  const labels = labelRows ?? [];
  const labelsByMatter: Record<string, Label[]> = {};
  const labelById = new Map(labels.map((l) => [l.id, l]));
  for (const a of assignmentRows ?? []) {
    const l = labelById.get(a.label_id);
    if (l) (labelsByMatter[a.matter_id] ??= []).push(l);
  }
  if (label) {
    const tagged = new Set((assignmentRows ?? []).filter((a) => a.label_id === label).map((a) => a.matter_id));
    matters = matters.filter((m) => tagged.has(m.id));
  }

  // Per-tab counts so a lawyer sees the size of each bucket before clicking.
  const { data: statusRows } = await supabase
    .from("matters")
    .select("matter_status, archived_at")
    .returns<{ matter_status: MatterStatus; archived_at: string | null }[]>();
  const counts: Record<string, number> = { all: 0, active: 0, on_hold: 0, disposed: 0, archived: 0 };
  for (const r of statusRows ?? []) {
    if (r.archived_at) counts.archived++;
    else {
      counts.all++;
      counts[r.matter_status]++;
    }
  }

  const tabHref = (s: string) =>
    `/matters?${new URLSearchParams({ ...(q ? { q } : {}), ...(label ? { label } : {}), ...(s !== "all" ? { status: s } : {}) })}`;
  const labelHref = (id: string) =>
    `/matters?${new URLSearchParams({ ...(q ? { q } : {}), ...(status !== "all" ? { status } : {}), ...(id ? { label: id } : {}) })}`;

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <PageHeader title="Matters" subtitle="Your case files.">
        <HelpLink anchor="add-a-matter" label="Matters" />
        <Link href="/matters/new" className={buttonVariants({ size: "sm" })}>
          + New matter
        </Link>
      </PageHeader>

      <form className="relative mb-4" action="/matters">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Search by title, key or CNR…" className="pl-9" />
      </form>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const active = (status || "all") === t.value;
          const n = counts[t.value] ?? 0;
          return (
            <Link
              key={t.value}
              href={tabHref(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent/40",
              )}
            >
              {t.label}
              <span className={cn("tnum", active ? "text-foreground/70" : "text-muted-foreground/70")}>{n}</span>
            </Link>
          );
        })}
      </div>

      {labels.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {labels.map((l) => {
            const active = label === l.id;
            return (
              <Link
                key={l.id}
                href={labelHref(active ? "" : l.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  active ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent/40",
                )}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: l.color ?? "var(--muted-foreground)" }} />
                {l.name}
              </Link>
            );
          })}
        </div>
      )}

      {matters.length === 0 ? (
        q ? (
          <EmptyState
            variant="no-results"
            title="No matters match your search"
            description="Try a different title, internal id, or CNR — or clear the search and filters."
            action={
              <Link href="/matters" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Clear search
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={Scale}
            title="No matters yet"
            description="A matter is a single case file — it holds the hearings, deadlines, documents and the live court timeline. Create your first to start tracking."
            action={
              <Link href="/matters/new" className={buttonVariants({ size: "sm" })}>
                + New matter
              </Link>
            }
          />
        )
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {matters.map((m) => (
            <li key={m.id}>
              <Link
                href={`/matters/${m.id}`}
                className="flex items-center gap-3 bg-card px-4 py-3.5 transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.title}</div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <MatterStatusBadge status={m.matter_status} />
                    <span aria-hidden>·</span>
                    <span>{FORUM_LABELS[m.forum_type]}</span>
                    <span className="font-mono tnum">{m.key}</span>
                    {m.client && <span>· {m.client.display_name}</span>}
                  </div>
                  {(labelsByMatter[m.id]?.length ?? 0) > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {labelsByMatter[m.id].map((l) => (
                        <LabelChip key={l.id} label={l} />
                      ))}
                    </div>
                  )}
                </div>
                {m.next_hearing_date ? (
                  <HearingPill date={m.next_hearing_date} />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
