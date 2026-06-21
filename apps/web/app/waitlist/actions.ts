"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function joinWaitlist(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) redirect("/?error=" + encodeURIComponent("Please enter your email."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_waitlist", {
    p_email: email,
    p_full_name: String(formData.get("full_name") || "") || null,
  });
  if (error) redirect("/?error=" + encodeURIComponent(error.message));

  redirect("/waitlist?joined=1");
}
