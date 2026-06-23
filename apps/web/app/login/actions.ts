"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSignInEmail } from "@/lib/email";
import { redirectWithError } from "@/lib/redirect";

// Resolve the public origin for building the magic link. Prefer the configured
// site URL; fall back to request headers for local dev.
async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}

// Passwordless sign-in. Mints a magic-link token server-side (no Supabase email),
// then sends our own email via Resend carrying a one-tap link AND a 6-digit code.
// New emails are created + waitlisted (invite-only is enforced later by the
// (app) layout's has_access gate); existing users just get a fresh link/code.
export async function requestSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) redirectWithError("/login", "Enter a valid email.");

  const admin = createAdminClient();

  // Ensure the user exists so a magic link can be minted. Ignore "already exists".
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  const isNew = !createErr;
  if (createErr && !/already|exist|registered/i.test(createErr.message)) {
    redirectWithError("/login", createErr.message);
  }
  if (isNew) {
    await admin.rpc("join_waitlist", { p_email: email, p_full_name: null });
  }

  const origin = await siteOrigin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}/auth/callback?next=/home` },
  });
  if (error || !data?.properties) {
    redirectWithError("/login", "Couldn't start sign-in. Please try again.");
  }

  const { hashed_token, email_otp } = data!.properties;
  const link = `${origin}/auth/callback?token_hash=${hashed_token}&type=magiclink&next=/home`;

  const sent = await sendSignInEmail({ to: email, link, code: email_otp });
  if ("error" in sent && sent.error) {
    redirectWithError("/login", "We couldn't send the email. Please try again.");
  }

  redirect(`/login/verify?email=${encodeURIComponent(email)}`);
}

// Verify the 6-digit code the user typed (the prefetch-/cross-device-proof path).
// Uses the per-request user client so the session cookies are set on success.
export async function verifyCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const back = `/login/verify?email=${encodeURIComponent(email)}`;
  // OTP length is configurable in Supabase (currently 8) — don't hard-code it.
  if (code.length < 6) redirectWithError(back, "Enter the code from your email.");

  const supabase = await createClient();
  // The OTP for a magic-link token verifies as type "email"; fall back to
  // "magiclink" across Supabase versions.
  let { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    ({ error } = await supabase.auth.verifyOtp({ email, token: code, type: "magiclink" }));
  }
  if (error) redirectWithError(back, "That code didn't work — check it or request a new one.");

  revalidatePath("/", "layout");
  redirect("/home");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
