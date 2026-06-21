"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Seeds a realistic set of demo matters (idempotent — clears prior DEMO-* data
// first) so a new lawyer can see the app working end to end.
export async function seedSampleData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const lawyer_id = user.id;

  await supabase.from("matters").delete().eq("lawyer_id", lawyer_id).like("key", "DEMO-%");

  const { data: states } = await supabase
    .from("workflow_states")
    .select("id, name")
    .is("lawyer_id", null);
  const sid = (name: string) => states?.find((s) => s.name === name)?.id;
  const todo = sid("To-Do");
  const inProgress = sid("In Progress");
  const blocked = sid("Blocked");

  const base = new Date();
  const day = (o: number) => {
    const x = new Date(base);
    x.setDate(x.getDate() + o);
    return x.toISOString().slice(0, 10);
  };
  const at = (o: number) => {
    const x = new Date(base);
    x.setDate(x.getDate() + o);
    return x.toISOString();
  };

  async function addMatter(m: Record<string, unknown>) {
    const { data } = await supabase
      .from("matters")
      .insert({ lawyer_id, ...m })
      .select("id")
      .single();
    return data!.id as string;
  }

  // ── Matter 1 — arbitration, hearing in 3 days, rich timeline ──────────────
  const m1 = await addMatter({
    key: "DEMO-1",
    cnr: "TSHC010004232025",
    forum_type: "arbitration",
    title: "MBECL vs SCCL",
    parties: {
      petitioners: ["McNally Bharat Engineering Co. Ltd."],
      respondents: ["Singareni Collieries Co. Ltd."],
    },
    case_type: "OMP (COMM.)",
    court_status: "Pending",
    matter_status: "active",
    lifecycle_state: "active",
    next_hearing_date: day(3),
  });
  await supabase.from("hearings").insert([
    { lawyer_id, matter_id: m1, hearing_date: day(3), purpose: "Arguments on interim relief", source: "ecourt", state: "scheduled", ordinal: 0 },
    { lawyer_id, matter_id: m1, hearing_date: day(-22), purpose: "Filing of reply", outcome: "Adjourned", source: "ecourt", state: "held", ordinal: 0 },
  ]);
  await supabase.from("court_events").insert([
    { lawyer_id, matter_id: m1, event_type: "order_uploaded", new_value: "Interim order uploaded", occurred_at: at(-8), source_type: "ecourt", content_hash: "demo-m1-e1" },
    { lawyer_id, matter_id: m1, event_type: "hearing_date_changed", previous_value: day(-2), new_value: day(3), occurred_at: at(-6), source_type: "ecourt", content_hash: "demo-m1-e2" },
  ]);
  await supabase.from("remarks").insert([
    { lawyer_id, matter_id: m1, body: "Client informed of the new hearing date. Rejoinder to be filed before the next date.", created_at: at(-5) },
  ]);
  await supabase.from("actions").insert([
    { lawyer_id, matter_id: m1, key: "DEMO-A1", title: "File rejoinder to respondent's reply", state_id: inProgress, priority: "high", due_date: day(2), source: "manual" },
    { lawyer_id, matter_id: m1, key: "DEMO-A2", title: "Brief senior counsel for arguments", state_id: todo, priority: "medium", due_date: day(2), source: "manual" },
  ]);
  await supabase.from("triage_items").insert([
    { lawyer_id, matter_id: m1, kind: "order_uploaded", summary: "New interim order uploaded on eCourts", state: "pending" },
  ]);

  // ── Matter 2 — district court, hearing in 9 days ──────────────────────────
  const m2 = await addMatter({
    key: "DEMO-2",
    cnr: "DLHC010012342024",
    forum_type: "high_court",
    title: "Sharma vs State of Delhi",
    parties: { petitioners: ["Rakesh Sharma"], respondents: ["State of Delhi"] },
    case_type: "W.P.(CRL)",
    court_status: "Pending",
    matter_status: "active",
    lifecycle_state: "active",
    next_hearing_date: day(9),
  });
  await supabase.from("court_events").insert([
    { lawyer_id, matter_id: m2, event_type: "status_changed", previous_value: "Fresh", new_value: "Pending", occurred_at: at(-15), source_type: "ecourt", content_hash: "demo-m2-e1" },
  ]);
  await supabase.from("actions").insert([
    { lawyer_id, matter_id: m2, key: "DEMO-A3", title: "Collect medical records from client", state_id: blocked, priority: "medium", due_date: day(6), source: "manual" },
  ]);
  await supabase.from("triage_items").insert([
    { lawyer_id, matter_id: m2, kind: "hearing_date_changed", summary: "Hearing date listed for " + day(9), state: "pending" },
  ]);

  // ── Matter 3 — NCLT, no near hearing ──────────────────────────────────────
  const m3 = await addMatter({
    key: "DEMO-3",
    forum_type: "nclt",
    title: "Acme Industries — CIRP",
    parties: { petitioners: ["Acme Industries Pvt. Ltd."], respondents: ["Beta Components Ltd."] },
    case_type: "CP (IB)",
    matter_status: "active",
    lifecycle_state: "active",
    next_hearing_date: day(24),
  });
  await supabase.from("remarks").insert([
    { lawyer_id, matter_id: m3, body: "Section 9 petition admitted. Awaiting constitution of CoC.", created_at: at(-3) },
  ]);
  await supabase.from("actions").insert([
    { lawyer_id, matter_id: m3, key: "DEMO-A4", title: "Verify claims received from creditors", state_id: todo, priority: "low", source: "manual" },
  ]);

  revalidatePath("/", "layout");
  redirect("/today");
}

// Removes the demo data (used by the "see it in action" toggle when turned off).
export async function clearSampleData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.from("matters").delete().eq("lawyer_id", user.id).like("key", "DEMO-%");
  revalidatePath("/", "layout");
}
