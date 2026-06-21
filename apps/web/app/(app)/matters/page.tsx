import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState } from "@/components/page-header";
import { HearingPill } from "@/components/badges";
import { FORUM_LABELS, type ForumType, type MatterStatus } from "@/lib/types";
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
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "all" } = await searchParams;
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
  const matters = rows ?? [];

  const tabHref = (s: string) =>
    `/matters?${new URLSearchParams({ ...(q ? { q } : {}), ...(s !== "all" ? { status: s } : {}) })}`;

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <PageHeader title="Matters" subtitle="Your case files.">
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
          return (
            <Link
              key={t.value}
              href={tabHref(t.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent/40",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {matters.length === 0 ? (
        <EmptyState
          title={q ? "No matters match your search" : "No matters yet"}
          hint={q ? undefined : "Create your first one to get started."}
          action={
            !q ? (
              <Link href="/matters/new" className={buttonVariants({ size: "sm" })}>
                + New matter
              </Link>
            ) : undefined
          }
        />
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
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{FORUM_LABELS[m.forum_type]}</span>
                    <span className="font-mono tnum">{m.key}</span>
                    {m.client && <span>· {m.client.display_name}</span>}
                  </div>
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
