import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { FORUM_LABELS, type Matter } from "@/lib/types";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function MattersPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("matters")
    .select("id, key, title, forum_type, matter_status, next_hearing_date")
    .order("next_hearing_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<Matter[]>();

  const matters = rows ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Matters</h1>
        <Link href="/matters/new" className={buttonVariants({ size: "sm" })}>
          + New matter
        </Link>
      </header>

      {matters.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No matters yet. Create your first one.
        </div>
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
                  <div className="text-xs text-muted-foreground">
                    {FORUM_LABELS[m.forum_type]} · <span className="font-mono tnum">{m.key}</span> ·{" "}
                    <span className="capitalize">{m.matter_status}</span>
                  </div>
                </div>
                <span className="tnum shrink-0 text-sm">
                  {m.next_hearing_date ? fmtDate(m.next_hearing_date) : "—"}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
