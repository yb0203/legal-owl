import { createClient } from "@supabase/supabase-js";

// Service-role client for privileged, SERVER-ONLY operations (minting sign-in
// tokens, creating users). Uses the secret key — never expose it to the browser
// and never import this from a client component. Bypasses RLS by design.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
