import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createMatter } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FORUM_TYPES, FORUM_LABELS } from "@/lib/types";

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function NewMatterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; client?: string }>;
}) {
  const { error, client } = await searchParams;
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, display_name")
    .order("display_name")
    .returns<{ id: string; display_name: string }[]>();

  return (
    <main className="mx-auto max-w-xl p-6 sm:p-8">
      <Link href="/matters" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Matters
      </Link>
      <h1 className="mb-6 mt-3 font-serif text-2xl font-semibold tracking-tight">New matter</h1>

      <form action={createMatter} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required placeholder="e.g. MBECL vs SCCL" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="client_id">Client</Label>
          <select id="client_id" name="client_id" defaultValue={client ?? ""} className={selectCls}>
            <option value="">No client</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="forum_type">Forum</Label>
            <select id="forum_type" name="forum_type" defaultValue="district" className={selectCls}>
              {FORUM_TYPES.map((f) => (
                <option key={f} value={f}>
                  {FORUM_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="case_type">Case type</Label>
            <Input id="case_type" name="case_type" placeholder="e.g. W.P.(C)" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="petitioners">Petitioners</Label>
            <Textarea id="petitioners" name="petitioners" rows={2} placeholder="One per line" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="respondents">Respondents</Label>
            <Textarea id="respondents" name="respondents" rows={2} placeholder="One per line" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cnr">
              CNR <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id="cnr" name="cnr" placeholder="e.g. DLHC010001232024" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="first_hearing_date">First hearing</Label>
            <Input id="first_hearing_date" name="first_hearing_date" type="date" />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full">
          Create matter
        </Button>
      </form>
    </main>
  );
}
