import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// DEV ONLY. Establishes a real Supabase session for DEV_LOGIN_EMAIL with no
// login step, so localhost lands straight in the app (RLS needs a real
// auth.uid(), so a fake bypass wouldn't load data). Guarded hard: returns 404
// unless NODE_ENV=development AND DEV_LOGIN_EMAIL is set, and DEV_LOGIN_EMAIL
// lives only in apps/web/.env.local (never in Vercel), so this is inert in prod.
export async function GET(request: NextRequest) {
  const email = process.env.DEV_LOGIN_EMAIL;
  if (process.env.NODE_ENV !== "development" || !email) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { origin, searchParams } = new URL(request.url);
  const nextParam = searchParams.get("next") ?? "/home";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/home";

  const admin = createAdminClient();
  // Ensure the dev user exists (ignore "already registered").
  await admin.auth.admin.createUser({ email, email_confirm: true });

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) {
    return NextResponse.redirect(`${origin}/login?error=dev_login_failed`);
  }

  // Verify via the per-request user client so session cookies are set.
  const supabase = await createClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyErr) return NextResponse.redirect(`${origin}/login?error=dev_login_failed`);

  return NextResponse.redirect(`${origin}${next}`);
}
