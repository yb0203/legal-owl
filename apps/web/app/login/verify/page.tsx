import Link from "next/link";
import { requestSignIn, verifyCode } from "../actions";
import { AuthShell } from "@/components/auth-shell";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email = "", error } = await searchParams;

  return (
    <AuthShell>
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We sent a sign-in link and a 6-digit code to{" "}
        <span className="font-medium text-foreground">{email || "your email"}</span>. Tap the link, or
        enter the code below.
      </p>

      <form className="mt-6 space-y-4">
        <input type="hidden" name="email" value={email} />
        <div className="space-y-1.5">
          <Label htmlFor="code">Sign-in code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            required
            autoFocus
            placeholder="1234 5678"
            className="text-center text-lg tracking-[0.25em] tnum"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <AuthSubmitButton action={verifyCode} pendingText="Verifying…" className="w-full">
          Verify &amp; sign in
        </AuthSubmitButton>
      </form>

      <form className="mt-4">
        <input type="hidden" name="email" value={email} />
        <p className="text-sm text-muted-foreground">
          Didn&apos;t get it?{" "}
          <AuthSubmitButton
            action={requestSignIn}
            pendingText="Resending…"
            variant="ghost"
            size="sm"
            className="h-auto p-0 align-baseline text-foreground underline underline-offset-4"
          >
            Resend
          </AuthSubmitButton>{" "}
          or{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            use a different email
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
