"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { redirectWithError } from "@/lib/redirect";
import { sendWaitlistConfirmation } from "@/lib/email";

export async function joinWaitlist(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) redirectWithError("/", "Please enter your email.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_waitlist", {
    p_email: email,
    p_full_name: String(formData.get("full_name") || "") || null,
  });
  if (error) redirectWithError("/", error.message);

  // Best-effort confirmation email (won't block joining if it fails).
  await sendWaitlistConfirmation(email);

  redirect("/waitlist?joined=1");
}
