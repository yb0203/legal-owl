"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createMatter(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Human key M-<n>, scoped to this lawyer (RLS scopes the count automatically).
  const { count } = await supabase
    .from("matters")
    .select("id", { count: "exact", head: true });
  const key = "M-" + ((count ?? 0) + 1);

  const cnr = String(formData.get("cnr") || "").trim() || null;

  const { error } = await supabase.from("matters").insert({
    lawyer_id: user.id,
    key,
    title: String(formData.get("title")),
    forum_type: String(formData.get("forum_type") || "district"),
    cnr,
  });

  if (error) redirect("/matters/new?error=" + encodeURIComponent(error.message));
  revalidatePath("/matters");
  redirect("/matters");
}
