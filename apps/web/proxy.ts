import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Next reads the matcher from an export literally named `config` (not
// `proxyConfig`). With the wrong name the matcher is ignored, so the Supabase
// session proxy runs on every request — including /_next/static/* — and
// redirects unauthenticated asset requests to /login, leaving the page unstyled.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
