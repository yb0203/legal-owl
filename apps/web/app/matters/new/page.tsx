import Link from "next/link";
import { createMatter } from "./actions";

const FORUMS = [
  "district",
  "high_court",
  "supreme_court",
  "nclt",
  "nclat",
  "arbitration",
  "tribunal",
  "other",
];

export default async function NewMatterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-lg p-6">
      <Link href="/matters" className="text-sm text-gray-500">
        ← Matters
      </Link>
      <h1 className="mb-6 mt-2 text-xl font-semibold">New matter</h1>

      <form action={createMatter} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            name="title"
            required
            placeholder="e.g. MBECL vs SCCL"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Forum</label>
          <select
            name="forum_type"
            defaultValue="district"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {FORUMS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            CNR <span className="text-gray-400">(optional — eCourts link)</span>
          </label>
          <input
            name="cnr"
            placeholder="e.g. DLHC010001232024"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white">
          Create matter
        </button>
      </form>
    </main>
  );
}
