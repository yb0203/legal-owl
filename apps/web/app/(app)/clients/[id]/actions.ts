"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addContact(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  const name = String(formData.get("name") || "").trim();
  if (!clientId || !name) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const text = (k: string) => String(formData.get(k) || "").trim() || null;
  await supabase.from("contacts").insert({
    lawyer_id: user.id,
    client_id: clientId,
    name,
    role: text("role"),
    email: text("email"),
    phone: text("phone"),
  });
  revalidatePath(`/clients/${clientId}`);
}

export async function dismissConflict(formData: FormData) {
  const flagId = String(formData.get("flag_id"));
  const clientId = String(formData.get("client_id"));
  if (!flagId) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("conflict_flags").update({ status: "dismissed" }).eq("id", flagId);
  revalidatePath(`/clients/${clientId}`);
}
