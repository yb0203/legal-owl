"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addRemark(formData: FormData) {
  const matterId = String(formData.get("matter_id"));
  const body = String(formData.get("body") || "").trim();
  if (!matterId || !body) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("remarks").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    body,
  });
  revalidatePath(`/matters/${matterId}`);
}
