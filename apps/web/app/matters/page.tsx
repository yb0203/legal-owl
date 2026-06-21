import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import type { Matter } from "@/lib/types";

export default async function MattersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: matters } = await supabase
    .from("matters")
    .select("*")
    .order("next_hearing_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rows = (matters ?? []) as Matter[];

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Matters</h1>
          <p className="text-sm text-gray-500">{user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/matters/new"
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
          >
            + New matter
          </Link>
          <form action={logout}>
            <button className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          No matters yet. Create your first one.
        </div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Key</th>
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">Forum</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Next hearing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                  {m.key}
                </td>
                <td className="py-2 pr-4">{m.title}</td>
                <td className="py-2 pr-4">{m.forum_type}</td>
                <td className="py-2 pr-4">{m.matter_status}</td>
                <td className="py-2 pr-4">{m.next_hearing_date ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
