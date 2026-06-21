"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  redirect("/today");
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
  redirect("/today");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
