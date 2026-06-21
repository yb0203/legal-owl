import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWaitlistAccess } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { Wordmark } from "@/components/wordmark";
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
      <Centered title="You're in." body="Your access has been granted.">
        <Link href="/matters" className={buttonVariants()}>
          Open Legal Owl
        </Link>
      </Centered>
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
    <Centered title={title} body={body}>
      {user ? (
        <form action={logout}>
          <Button variant="outline">Sign out</Button>
        </form>
      ) : (
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          ← Back home
        </Link>
      )}
    </Centered>
  );
}

function Centered({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <Wordmark className="mb-8" />
        <h1 className="font-serif text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex justify-center">{children}</div>
      </div>
    </main>
  );
}
