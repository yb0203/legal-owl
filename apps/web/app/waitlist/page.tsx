import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWaitlistAccess } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { AuthShell } from "@/components/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ joined?: string }>;
}) {
  const { joined } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Approved + signed in shouldn't be here — send them in.
  if (user && (await getWaitlistAccess(supabase, user.email))) {
    return (
      <AuthShell>
        <Status title="You're in." body="Your access has been granted.">
          <Link href="/home" className={buttonVariants({ className: "w-full" })}>
            Open Legal Owl
          </Link>
        </Status>
      </AuthShell>
    );
  }

  const title = user
    ? "You're on the waitlist."
    : joined
      ? "You're on the list."
      : "Join the waitlist.";

  const body = user
    ? `Your account (${user.email}) is pending access. We'll email you the moment it's granted.`
    : joined
      ? "Thanks for your interest — we'll email you when your access is ready."
      : "Legal Owl is invite-only for now.";

  return (
    <AuthShell>
      <Status title={title} body={body}>
        {user ? (
          <form action={logout}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        ) : (
          <Link href="/" className={buttonVariants({ variant: "outline", className: "w-full" })}>
            ← Back home
          </Link>
        )}
      </Status>
    </AuthShell>
  );
}

function Status({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
