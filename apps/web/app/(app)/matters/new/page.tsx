import Link from "next/link";
import { createMatter } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORUM_TYPES, FORUM_LABELS } from "@/lib/types";

export default async function NewMatterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-lg p-6">
      <Link href="/matters" className="text-sm text-muted-foreground">
        ← Matters
      </Link>
      <h1 className="mb-6 mt-2 font-serif text-xl font-semibold">New matter</h1>

      <form action={createMatter} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required placeholder="e.g. MBECL vs SCCL" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="forum_type">Forum</Label>
          <select
            id="forum_type"
            name="forum_type"
            defaultValue="district"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {FORUM_TYPES.map((f) => (
              <option key={f} value={f}>
                {FORUM_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cnr">
            CNR <span className="text-muted-foreground">(optional — eCourts link)</span>
          </Label>
          <Input id="cnr" name="cnr" placeholder="e.g. DLHC010001232024" className="font-mono" />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full">
          Create matter
        </Button>
      </form>
    </main>
  );
}
