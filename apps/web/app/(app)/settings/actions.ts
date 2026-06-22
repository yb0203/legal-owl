"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const clean = (v: FormDataEntryValue | null) => String(v || "").trim() || null;

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: clean(formData.get("full_name")),
      firm_name: clean(formData.get("firm_name")),
      phone: clean(formData.get("phone")),
      bar_enrolment: clean(formData.get("bar_enrolment")),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
