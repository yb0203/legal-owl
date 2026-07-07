import { PageShell, BackLink } from "@/components/layout";
import { AddMatterByCnr } from "./add-matter-by-cnr";

export default async function NewMatterPage() {
  return (
    <PageShell size="sm">
      <BackLink href="/matters">Matters</BackLink>
      <h1 className="mb-2 mt-3 font-serif text-2xl font-semibold tracking-tight">Add matter</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Enter the CNR — Legal Owl fetches all case details from eCourts and creates the record automatically.
      </p>
      <AddMatterByCnr />
    </PageShell>
  );
}
