import Link from "next/link";
import { requestPasswordReset } from "../actions";
import { AuthShell } from "@/components/auth-shell";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <AuthShell>
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Reset your password</h1>

      {sent ? (
        <p className="mt-3 text-sm text-muted-foreground">
          If that email is registered, we&apos;ve sent a reset link. Check your inbox and follow the
          link to set a new password.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
          <form className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@chambers.in" />
            </div>
            <AuthSubmitButton
              action={requestPasswordReset}
              pendingText="Sending…"
              className="w-full"
            >
              Send reset link
            </AuthSubmitButton>
          </form>
        </>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
