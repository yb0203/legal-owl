import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWaitlistAccess } from "@/lib/auth";

// Access gate: requires an authenticated user AND has_access = true (flipped from
// the Supabase dashboard). Everyone else goes to the waitlist screen.
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

  return <>{children}</>;
}
