import { updatePassword } from "../actions";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell>
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>

      <form className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" required placeholder="Min. 6 characters" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" formAction={updatePassword} className="w-full">
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
