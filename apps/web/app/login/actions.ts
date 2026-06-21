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
  const { error } = await supabase.auth.signUp({
    email,
    password: String(formData.get("password")),
  });
  if (error) redirectWithError("/login", error.message);
  // Record the signup on the waitlist so an admin can grant access. New accounts
  // start without access and land on the waitlist screen until approved.
  await supabase.rpc("join_waitlist", { p_email: email, p_full_name: null });
  revalidatePath("/", "layout");
  redirect("/waitlist");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
