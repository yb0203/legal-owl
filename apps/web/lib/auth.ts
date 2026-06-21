import type { SupabaseClient } from "@supabase/supabase-js";

// Whether the given email has been granted access (has_access flipped from the
// Supabase dashboard). Shared by the app gate and the waitlist screen.
export async function getWaitlistAccess(
  supabase: SupabaseClient,
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  const { data } = await supabase
    .from("waitlist")
    .select("has_access")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return data?.has_access ?? false;
}
