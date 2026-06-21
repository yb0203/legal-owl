import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { DemoToggle } from "@/components/demo-toggle";
import { PageHeader, SectionCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}

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
    <main className="mx-auto w-full max-w-2xl p-6 sm:p-8">
      <PageHeader title="Settings" subtitle="Your account and preferences." />

      <div className="space-y-6">
        <SectionCard title="Explore">
          <div className="p-4">
            <DemoToggle enabled={(demoCount ?? 0) > 0} />
          </div>
        </SectionCard>

        <SectionCard title="Profile">
          <dl className="divide-y">
            <Row label="Email" value={user?.email} />
            <Row label="Data residency" value="Mumbai, India (ap-south-1)" />
          </dl>
        </SectionCard>

        <SectionCard title="eCourts connection">
          <div className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm text-muted-foreground">
              Connect your eCourts access to sync case status, orders and hearing dates automatically.
            </p>
            <Button type="button" variant="outline" size="sm" disabled>
              Connect — soon
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Notifications">
          <div className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm text-muted-foreground">
              Email digests and client-update delivery settings will live here.
            </p>
            <Button type="button" variant="outline" size="sm" disabled>
              Soon
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Account">
          <div className="p-4">
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
