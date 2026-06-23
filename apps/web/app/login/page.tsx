import Link from "next/link";
import { requestSignIn } from "./actions";
import { AuthShell } from "@/components/auth-shell";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell>
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Sign in to Legal Owl</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        No passwords. Enter your email and we&apos;ll send a one-tap link and a sign-in code.
      </p>

      <form className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoFocus placeholder="you@chambers.in" />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <AuthSubmitButton action={requestSignIn} pendingText="Sending…" className="w-full">
          Email me a sign-in link
        </AuthSubmitButton>

        <p className="text-center text-xs text-muted-foreground">
          New here? You&apos;ll join the waitlist — access is invite-only, and we&apos;ll email you
          when your account is approved.
        </p>
      </form>

      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/" className="text-foreground underline underline-offset-4">
          Back to home
        </Link>
      </p>
    </AuthShell>
  );
}
