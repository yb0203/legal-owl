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

  const [{ count: inboxCount }, { data: matters }] = await Promise.all([
    supabase
      .from("triage_items")
      .select("id", { count: "exact", head: true })
      .eq("state", "pending"),
    supabase
      .from("matters")
      .select("id, title, key")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<{ id: string; title: string; key: string }[]>(),
  ]);

  return (
    <SidebarProvider>
      <AppSidebar email={user.email} inboxCount={inboxCount ?? 0} />
      <SidebarInset>
        <AppHeader matters={matters ?? []} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
