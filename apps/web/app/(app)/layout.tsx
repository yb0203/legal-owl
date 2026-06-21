import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWaitlistAccess } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";

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

  const { count: triageCount } = await supabase
    .from("triage_items")
    .select("id", { count: "exact", head: true })
    .eq("state", "pending");

  return (
    <SidebarProvider>
      <AppSidebar email={user.email} triageCount={triageCount ?? 0} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
