"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirectWithError } from "@/lib/redirect";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) redirectWithError("/login", error.message);
  revalidatePath("/", "layout");
  redirect("/home");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) redirectWithError("/login", error.message);
  // Record the signup on the waitlist so an admin can grant access.
  await supabase.rpc("join_waitlist", { p_email: email, p_full_name: null });
  // Email is auto-confirmed (DB trigger), so establish a session right away.
  await supabase.auth.signInWithPassword({ email, password });
  revalidatePath("/", "layout");
  redirect("/home");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Send a password-reset email. The link returns the user via /auth/callback
// (which exchanges the code for a session) and on to the update-password page.
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email"));
  const supabase = await createClient();
  // Prefer a trusted configured origin; fall back to request headers (which are
  // spoofable) only when it isn't set. Keep the Supabase redirect allowlist tight.
  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/login/update`,
  });
  if (error) console.error("[reset-password]", error.message);
  // Always confirm without revealing whether the email is registered.
  redirect("/login/reset?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password"));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirectWithError("/login/update", error.message);
  revalidatePath("/", "layout");
  redirect("/home");
}
