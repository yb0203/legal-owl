import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Establishes a session from an email link (password recovery, magic link, email
// confirmation), then forwards to the requested next path. Supports two link
// shapes so reset works across devices/browsers:
//   - token_hash + type  → verifyOtp  (no PKCE code-verifier cookie needed; the
//     resilient path our recovery email uses)
//   - code               → exchangeCodeForSession (PKCE/OAuth fallback)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/home";
  // Only same-origin relative paths — never an attacker-controlled redirect.
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/\\")
      ? nextParam
      : "/home";

  const supabase = await createClient();

  let failed = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = !!error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = !!error;
  } else {
    failed = true;
  }

  if (failed) return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  return NextResponse.redirect(`${origin}${next}`);
}
