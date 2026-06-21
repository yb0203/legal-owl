import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { FORUM_LABELS, type Matter } from "@/lib/types";

export default async function MattersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("matters")
    .select("id, key, title, forum_type, matter_status, next_hearing_date")
    .order("next_hearing_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<Matter[]>();

  const matters = rows ?? [];

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl font-semibold">Matters</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <Link href="/matters/new" className={buttonVariants({ size: "sm" })}>
          + New matter
        </Link>
      </header>

      {matters.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No matters yet. Create your first one.
        </div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Key</th>
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">Forum</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Next hearing</th>
            </tr>
          </thead>
          <tbody>
            {matters.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="tnum py-2 pr-4 font-mono text-xs text-muted-foreground">
                  {m.key}
                </td>
                <td className="py-2 pr-4">{m.title}</td>
                <td className="py-2 pr-4">{FORUM_LABELS[m.forum_type]}</td>
                <td className="py-2 pr-4">{m.matter_status}</td>
                <td className="tnum py-2 pr-4">{m.next_hearing_date ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
