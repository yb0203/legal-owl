import { createClientRecord } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageShell, BackLink } from "@/components/layout";
import { NativeSelect } from "@/components/native-select";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <PageShell size="sm">
      <BackLink href="/clients">Clients</BackLink>
      <h1 className="mb-1 mt-3 font-serif text-2xl font-semibold tracking-tight">New client</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        We&apos;ll run a quick conflict check against your existing matters.
      </p>

      <form action={createClientRecord} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="display_name">Name</Label>
          <Input id="display_name" name="display_name" required placeholder="e.g. Rakesh Sharma / Acme Industries Pvt. Ltd." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <NativeSelect id="type" name="type" defaultValue="individual">
              <option value="individual">Individual</option>
              <option value="organisation">Organisation</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <NativeSelect id="status" name="status" defaultValue="active">
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </NativeSelect>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" name="address" rows={2} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="gstin">GSTIN <span className="text-muted-foreground">(org)</span></Label>
            <Input id="gstin" name="gstin" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pan">PAN</Label>
            <Input id="pan" name="pan" className="font-mono" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={2} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full">
          Create client
        </Button>
      </form>
    </PageShell>
  );
}
