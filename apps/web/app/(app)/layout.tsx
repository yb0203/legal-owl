import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Access gate for the whole app. Requires an authenticated user AND a waitlist
// row with has_access = true (flipped from the Supabase dashboard). Everyone
// else is sent to the waitlist screen.
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

  const { data } = await supabase
    .from("waitlist")
    .select("has_access")
    .eq("email", (user.email ?? "").toLowerCase())
    .maybeSingle();

  if (!data?.has_access) redirect("/waitlist");

  return <>{children}</>;
}
