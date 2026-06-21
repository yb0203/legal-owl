import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { DemoToggle } from "@/components/demo-toggle";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count: demoCount } = await supabase
    .from("matters")
    .select("id", { count: "exact", head: true })
    .like("key", "DEMO-%");

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your account and preferences.</p>

      <section className="mt-8 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-medium text-muted-foreground">Explore</h2>
        <div className="mt-3">
          <DemoToggle enabled={(demoCount ?? 0) > 0} />
        </div>
      </section>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-medium text-muted-foreground">Account</h2>
        <dl className="mt-3 text-sm">
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate">{user?.email}</dd>
          </div>
        </dl>
        <form action={logout} className="mt-4">
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </section>
    </main>
  );
}
