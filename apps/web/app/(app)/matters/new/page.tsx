import { createClient } from "@/lib/supabase/server";
import { PageShell, BackLink } from "@/components/layout";
import { MatterForm } from "./matter-form";

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
    <PageShell size="sm">
      <BackLink href="/matters">Matters</BackLink>
      <h1 className="mb-6 mt-3 font-serif text-2xl font-semibold tracking-tight">New matter</h1>
      <MatterForm
        clients={clients ?? []}
        defaultClientId={client}
        error={error}
      />
    </PageShell>
  );
}
