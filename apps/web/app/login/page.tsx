import Link from "next/link";
import { login, signup } from "./actions";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <Wordmark className="mb-8" />

        <h1 className="font-serif text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Access is invite-only.{" "}
          <Link href="/" className="text-foreground underline underline-offset-4">
            Join the waitlist
          </Link>
          .
        </p>

        <form className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="you@chambers.in" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required placeholder="Min. 6 characters" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="space-y-2 pt-1">
            <Button formAction={login} className="w-full">
              Sign in
            </Button>
            <Button formAction={signup} variant="outline" className="w-full">
              Create account
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
