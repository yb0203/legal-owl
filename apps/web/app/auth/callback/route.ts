import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Exchanges a Supabase auth code (e.g. password recovery) for a session, then
// forwards to the requested next path.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/home";
  // Only same-origin relative paths — never an attacker-controlled redirect.
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/\\")
      ? nextParam
      : "/home";

  if (!code) return NextResponse.redirect(`${origin}/login?error=invalid_link`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=invalid_link`);

  return NextResponse.redirect(`${origin}${next}`);
}
