import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWaitlistAccess } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
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
  const [
    { count: inboxCount },
    { count: tasksDueToday },
    { count: hearingsToday },
    { data: matters },
  ] = await Promise.all([
    supabase
      .from("triage_items")
      .select("id", { count: "exact", head: true })
      .eq("state", "pending"),
    // "Due today" badge counts what needs action now: due today or already overdue.
    supabase
      .from("actions")
      .select("id", { count: "exact", head: true })
      .is("completed_at", null)
      .lte("due_date", today),
    supabase
      .from("hearings")
      .select("id", { count: "exact", head: true })
      .eq("state", "scheduled")
      .eq("hearing_date", today),
    supabase
      .from("matters")
      .select("id, title, key")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<{ id: string; title: string; key: string }[]>(),
  ]);

  return (
    <SidebarProvider>
      <AppSidebar
        email={user.email}
        inboxCount={inboxCount ?? 0}
        tasksDueToday={tasksDueToday ?? 0}
        hearingsToday={hearingsToday ?? 0}
      />
      <SidebarInset>
        <AppHeader matters={matters ?? []} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
