import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { DemoToggle } from "@/components/demo-toggle";
import { ProfileForm, type ProfileValues } from "@/components/settings/profile-form";
import { PageHeader, SectionCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ count: demoCount }, { data: profile }] = await Promise.all([
    supabase.from("matters").select("id", { count: "exact", head: true }).like("key", "DEMO-%"),
    supabase
      .from("profiles")
      .select("full_name, firm_name, phone, bar_enrolment")
      .eq("id", user?.id ?? "")
      .maybeSingle<ProfileValues>(),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl p-6 sm:p-8">
      <PageHeader title="Settings" subtitle="Your account and preferences." />

      <div className="space-y-6">
        <SectionCard title="Profile">
          <ProfileForm email={user?.email} profile={profile ?? null} />
        </SectionCard>

        <SectionCard title="Data residency">
          <div className="flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Your data stays in India</p>
              <p className="text-muted-foreground">
                Case data, documents and identity are stored in Mumbai (ap-south-1) and never leave the
                country.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Explore">
          <div className="p-4">
            <DemoToggle enabled={(demoCount ?? 0) > 0} />
          </div>
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
