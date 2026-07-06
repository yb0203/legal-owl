import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWaitlistAccess } from "@/lib/auth";
import { getSystemStateId } from "@/lib/db";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { AssistantRail } from "@/components/assistant/assistant-rail";
import { SampleDataBanner } from "@/components/sample-data-banner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

// Access gate (auth + has_access) + the app shell: responsive sidebar + content.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await getWaitlistAccess(supabase, user.email))) redirect("/waitlist");

  const today = new Date().toISOString().slice(0, 10);
  const triageId = await getSystemStateId(supabase, "Triage");
  const [
    { count: inboxCount },
    { count: tasksDueToday },
    { count: hearingsToday },
    { data: matters },
    { count: sampleCount },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("type", "task")
      .eq("state_id", triageId ?? ""),
    // "Due today" badge counts what needs action now: due today or already overdue.
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("type", "task")
      .neq("state_id", triageId ?? "")
      .is("completed_at", null)
      .lte("due_date", today),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("type", "hearing")
      .eq("attributes->>court_state", "scheduled")
      .eq("due_date", today),
    supabase
      .from("matters")
      .select("id, title, key")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<{ id: string; title: string; key: string }[]>(),
    // Sample data is identified by the DEMO- matter-key prefix (see seedSampleData).
    supabase.from("matters").select("id", { count: "exact", head: true }).like("key", "DEMO-%"),
  ]);

  return (
    <SidebarProvider>
      <AppSidebar
        email={user.email}
        inboxCount={inboxCount ?? 0}
        tasksDueToday={tasksDueToday ?? 0}
        hearingsToday={hearingsToday ?? 0}
      />
      <SidebarInset className="h-svh overflow-hidden">
        {(sampleCount ?? 0) > 0 && <SampleDataBanner />}
        <AppHeader matters={matters ?? []} />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
          <AssistantRail />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
