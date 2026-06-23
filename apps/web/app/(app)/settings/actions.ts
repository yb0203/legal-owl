"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncOneMatter } from "@/lib/ecourts/run";

const clean = (v: FormDataEntryValue | null) => String(v || "").trim() || null;

// Sync every matter that has a CNR (capped). Used by the eCourts Settings card.
export async function syncAllMatters(): Promise<
  { ok: true; total: number; synced: number; changed: number; failed: number } | { ok: false }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { data: matters } = await supabase
    .from("matters")
    .select("id, lawyer_id, cnr, court_status, next_hearing_date")
    .not("cnr", "is", null)
    .neq("lifecycle_state", "disposed")
    .limit(100);
  let synced = 0;
  let changed = 0;
  let failed = 0;
  for (const m of matters ?? []) {
    const r = await syncOneMatter(supabase, m as Parameters<typeof syncOneMatter>[1]);
    if (r.ok) {
      synced += 1;
      if (r.summary.created > 0) changed += 1;
    } else if (r.reason !== "no_cnr") {
      failed += 1;
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, total: matters?.length ?? 0, synced, changed, failed };
}

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
