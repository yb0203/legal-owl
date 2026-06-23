"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureGeneralEngagement } from "@/lib/db";
import { getCase, getEnums } from "@/lib/ecourts/client";
import { normalizeCase } from "@/lib/ecourts/normalize";
import { syncMatter } from "@/lib/ecourts/sync";

const DEMO_CLIENT_TAG = "Sample data — added by “See it in action”.";
// Demo labels are shared with the real `labels` table, so they're cleared by
// name on teardown (see clearDemo).
const DEMO_LABEL_NAMES = ["Urgent", "Filing", "Awaiting client", "Appeal", "Retainer"];

// Seeds a realistic, varied set of demo clients + matters (idempotent — clears
// prior demo data first) so a new lawyer can see the whole app working end to
// end: overdue/today/upcoming work, a full inbox, labels, and a rich timeline.
export async function seedSampleData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const lawyer_id = user.id;

  await clearDemo(supabase, lawyer_id);

  const { data: states } = await supabase
    .from("workflow_states")
    .select("id, name")
    .is("lawyer_id", null);
  const sid = (name: string) => states?.find((s) => s.name === name)?.id;
  const todo = sid("To-Do");
  const awaitingFiling = sid("Awaiting Filing");
  const inProgress = sid("In Progress");
  const blocked = sid("Blocked");
  const done = sid("Done");

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

  async function addClient(rec: Record<string, unknown>) {
    const { data } = await supabase
      .from("clients")
      .insert({ lawyer_id, notes: DEMO_CLIENT_TAG, ...rec })
      .select("id")
      .single();
    return data!.id as string;
  }
  async function addMatter(m: Record<string, unknown>) {
    const { data } = await supabase
      .from("matters")
      .insert({ lawyer_id, ...m })
      .select("id")
      .single();
    return data!.id as string;
  }
  // Insert-or-ignore by (lawyer_id, name), mirroring createLabel; never throws on
  // a missing row so a label hiccup can't abort the core seed.
  async function addLabel(name: string, color: string): Promise<string | null> {
    const { data: created } = await supabase
      .from("labels")
      .upsert({ lawyer_id, name, color }, { onConflict: "lawyer_id,name", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (created) return created.id as string;
    const { data: existing } = await supabase
      .from("labels")
      .select("id")
      .eq("lawyer_id", lawyer_id)
      .eq("name", name)
      .maybeSingle();
    return (existing?.id as string) ?? null;
  }

  // ── Clients + their default engagements ───────────────────────────────────
  const cMbecl = await addClient({
    type: "organisation",
    display_name: "McNally Bharat Engineering Co. Ltd.",
    status: "active",
    email: "legal@mbecl.example",
  });
  const cSharma = await addClient({
    type: "individual",
    display_name: "Rakesh Sharma",
    status: "active",
    phone: "+91 98100 00000",
  });
  const cAcme = await addClient({
    type: "organisation",
    display_name: "Acme Industries Pvt. Ltd.",
    status: "active",
    email: "company.secretary@acme.example",
  });
  const cMehta = await addClient({
    type: "individual",
    display_name: "Priya Mehta",
    status: "active",
    email: "priya.mehta@example.com",
    phone: "+91 99200 11111",
  });
  const cZenith = await addClient({
    type: "organisation",
    display_name: "Zenith Retail Pvt. Ltd.",
    status: "lead",
    email: "founders@zenithretail.example",
  });
  const cVerma = await addClient({
    type: "individual",
    display_name: "Anil Verma",
    status: "inactive",
    phone: "+91 90000 22222",
  });
  const eMbecl = await ensureGeneralEngagement(supabase, lawyer_id, cMbecl);
  const eSharma = await ensureGeneralEngagement(supabase, lawyer_id, cSharma);
  const eAcme = await ensureGeneralEngagement(supabase, lawyer_id, cAcme);
  const eMehta = await ensureGeneralEngagement(supabase, lawyer_id, cMehta);
  const eZenith = await ensureGeneralEngagement(supabase, lawyer_id, cZenith);
  const eVerma = await ensureGeneralEngagement(supabase, lawyer_id, cVerma);

  // ── Matters ───────────────────────────────────────────────────────────────
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
    client_id: cMbecl,
    engagement_id: eMbecl,
  });
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
    client_id: cSharma,
    engagement_id: eSharma,
  });
  const m3 = await addMatter({
    key: "DEMO-3",
    forum_type: "nclt",
    title: "Acme Industries — CIRP",
    parties: { petitioners: ["Acme Industries Pvt. Ltd."], respondents: ["Beta Components Ltd."] },
    case_type: "CP (IB)",
    matter_status: "active",
    lifecycle_state: "active",
    next_hearing_date: day(24),
    client_id: cAcme,
    engagement_id: eAcme,
  });
  const m4 = await addMatter({
    key: "DEMO-4",
    cnr: "DLDC020045672024",
    forum_type: "district",
    title: "Mehta vs Kumar",
    parties: { petitioners: ["Priya Mehta"], respondents: ["Sandeep Kumar"] },
    case_type: "CS (Civil)",
    court_status: "Pending",
    matter_status: "active",
    lifecycle_state: "active",
    next_hearing_date: day(1),
    client_id: cMehta,
    engagement_id: eMehta,
  });
  const m5 = await addMatter({
    key: "DEMO-5",
    forum_type: "supreme_court",
    title: "Zenith Retail vs Union of India",
    parties: { petitioners: ["Zenith Retail Pvt. Ltd."], respondents: ["Union of India"] },
    case_type: "SLP (C)",
    matter_status: "active",
    lifecycle_state: "pending_first_sync",
    client_id: cZenith,
    engagement_id: eZenith,
  });
  const m6 = await addMatter({
    key: "DEMO-6",
    cnr: "DLNC050098762023",
    forum_type: "tribunal",
    title: "Verma vs Horizon Homebuilders",
    parties: { petitioners: ["Anil Verma"], respondents: ["Horizon Homebuilders Pvt. Ltd."] },
    case_type: "Consumer Complaint",
    court_status: "Disposed",
    matter_status: "disposed",
    lifecycle_state: "disposed",
    client_id: cVerma,
    engagement_id: eVerma,
  });

  // ── Hearings (past held + upcoming scheduled) ─────────────────────────────
  await supabase.from("hearings").insert([
    { lawyer_id, matter_id: m1, hearing_date: day(3), purpose: "Arguments on interim relief", source: "ecourt", state: "scheduled", ordinal: 0 },
    { lawyer_id, matter_id: m1, hearing_date: day(18), purpose: "Final arguments", source: "ecourt", state: "scheduled", ordinal: 0 },
    { lawyer_id, matter_id: m1, hearing_date: day(-22), purpose: "Filing of reply", outcome: "Adjourned", source: "ecourt", state: "held", ordinal: 0 },
    { lawyer_id, matter_id: m2, hearing_date: day(9), purpose: "Hearing on bail application", source: "ecourt", state: "scheduled", ordinal: 0 },
    { lawyer_id, matter_id: m2, hearing_date: day(-30), purpose: "Notice to respondents", outcome: "Notice issued", source: "ecourt", state: "held", ordinal: 0 },
    { lawyer_id, matter_id: m3, hearing_date: day(24), purpose: "Constitution of Committee of Creditors", source: "ecourt", state: "scheduled", ordinal: 0 },
    { lawyer_id, matter_id: m4, hearing_date: day(1), purpose: "Framing of issues", source: "ecourt", state: "scheduled", ordinal: 0 },
    { lawyer_id, matter_id: m4, hearing_date: day(-40), purpose: "Filing of written statement", outcome: "WS taken on record", source: "ecourt", state: "held", ordinal: 0 },
    { lawyer_id, matter_id: m6, hearing_date: day(-60), purpose: "Final hearing", outcome: "Complaint allowed", source: "ecourt", state: "held", ordinal: 0 },
  ]);

  // ── Court events (full range of event types) ──────────────────────────────
  await supabase.from("court_events").insert([
    { lawyer_id, matter_id: m1, event_type: "judge_changed", new_value: "Bench reconstituted", occurred_at: at(-12), source_type: "ecourt", content_hash: "demo-m1-e1" },
    { lawyer_id, matter_id: m1, event_type: "order_uploaded", new_value: "Interim order uploaded", occurred_at: at(-8), source_type: "ecourt", content_hash: "demo-m1-e2" },
    { lawyer_id, matter_id: m1, event_type: "hearing_date_changed", previous_value: day(-2), new_value: day(3), occurred_at: at(-6), source_type: "ecourt", content_hash: "demo-m1-e3" },
    { lawyer_id, matter_id: m1, event_type: "document_added", new_value: "Respondent's reply uploaded", occurred_at: at(-4), source_type: "ecourt", content_hash: "demo-m1-e4" },
    { lawyer_id, matter_id: m2, event_type: "status_changed", previous_value: "Fresh", new_value: "Pending", occurred_at: at(-15), source_type: "ecourt", content_hash: "demo-m2-e1" },
    { lawyer_id, matter_id: m2, event_type: "order_uploaded", new_value: "Order on bail application uploaded", occurred_at: at(-3), source_type: "ecourt", content_hash: "demo-m2-e2" },
    { lawyer_id, matter_id: m3, event_type: "status_changed", previous_value: "Fresh", new_value: "Admitted", occurred_at: at(-20), source_type: "ecourt", content_hash: "demo-m3-e1" },
    { lawyer_id, matter_id: m4, event_type: "hearing_date_changed", previous_value: day(-7), new_value: day(1), occurred_at: at(-5), source_type: "ecourt", content_hash: "demo-m4-e1" },
    { lawyer_id, matter_id: m4, event_type: "document_added", new_value: "Amended plaint uploaded", occurred_at: at(-2), source_type: "ecourt", content_hash: "demo-m4-e2" },
    { lawyer_id, matter_id: m6, event_type: "order_uploaded", new_value: "Final order uploaded", occurred_at: at(-55), source_type: "ecourt", content_hash: "demo-m6-e1" },
    { lawyer_id, matter_id: m6, event_type: "status_changed", previous_value: "Pending", new_value: "Disposed", occurred_at: at(-55), source_type: "ecourt", content_hash: "demo-m6-e2" },
  ]);

  // ── Remarks (lawyer's own notes) ──────────────────────────────────────────
  await supabase.from("remarks").insert([
    { lawyer_id, matter_id: m1, body: "Client informed of the new hearing date. Rejoinder to be filed before the next date.", created_at: at(-5) },
    { lawyer_id, matter_id: m1, body: "Senior counsel briefed; rejoinder draft circulated for review.", created_at: at(-2) },
    { lawyer_id, matter_id: m2, body: "Client to provide updated medical documents before the next date.", created_at: at(-1) },
    { lawyer_id, matter_id: m3, body: "Section 9 petition admitted. Awaiting constitution of CoC.", created_at: at(-3) },
    { lawyer_id, matter_id: m4, body: "Defendant likely to seek adjournment; oppose and press for issue framing.", created_at: at(-1) },
    { lawyer_id, matter_id: m5, body: "SLP drafted; to be filed this week. Awaiting eCourts listing after filing.", created_at: at(-1) },
    { lawyer_id, matter_id: m6, body: "Complaint allowed; compensation awarded to client. Matter closed.", created_at: at(-50) },
  ]);

  // ── Actions (overdue / today / upcoming, varied states) ───────────────────
  const { data: actionRows } = await supabase
    .from("actions")
    .insert([
      { lawyer_id, matter_id: m1, key: "DEMO-A1", title: "File rejoinder to respondent's reply", state_id: inProgress, priority: "high", due_date: day(2), source: "manual" },
      { lawyer_id, matter_id: m1, key: "DEMO-A2", title: "Brief senior counsel for arguments", state_id: todo, priority: "medium", due_date: day(2), source: "manual" },
      { lawyer_id, matter_id: m1, key: "DEMO-A3", title: "Pay arbitral tribunal fee", state_id: awaitingFiling, priority: "low", due_date: day(5), source: "manual" },
      { lawyer_id, matter_id: m2, key: "DEMO-A4", title: "Collect medical records from client", state_id: blocked, priority: "medium", due_date: day(6), source: "manual" },
      { lawyer_id, matter_id: m2, key: "DEMO-A5", title: "Draft bail application", state_id: todo, priority: "high", due_date: day(0), source: "manual" },
      { lawyer_id, matter_id: m3, key: "DEMO-A6", title: "Verify claims received from creditors", state_id: todo, priority: "low", source: "manual" },
      { lawyer_id, matter_id: m4, key: "DEMO-A7", title: "Prepare for issue framing", state_id: inProgress, priority: "high", due_date: day(0), source: "manual" },
      { lawyer_id, matter_id: m4, key: "DEMO-A8", title: "Serve amended plaint on defendant", state_id: todo, priority: "urgent", due_date: day(-3), source: "manual" },
      { lawyer_id, matter_id: m5, key: "DEMO-A9", title: "Finalise SLP paper-book", state_id: awaitingFiling, priority: "high", due_date: day(2), source: "manual" },
      { lawyer_id, matter_id: m6, key: "DEMO-A10", title: "Send closure note to client", state_id: done, priority: "none", source: "manual", completed_at: at(-48) },
    ])
    .select("id, key");
  const actionId = (key: string) => actionRows?.find((a) => a.key === key)?.id as string | undefined;

  // ── Deadlines (rule-bearing dates, incl. an overdue limitation) ───────────
  await supabase.from("deadlines").insert([
    { lawyer_id, matter_id: m1, type: "internal", due_date: day(1), basis: "Rejoinder to be filed" },
    { lawyer_id, matter_id: m1, type: "statutory", due_date: day(6), basis: "Window to file objections to interim order" },
    { lawyer_id, matter_id: m2, type: "limitation", due_date: day(4), basis: "Limitation to file revision petition" },
    { lawyer_id, matter_id: m4, type: "limitation", due_date: day(-1), basis: "Limitation for written statement (CPC Order VIII)" },
    { lawyer_id, matter_id: m4, type: "internal", due_date: day(3), basis: "Compile documents for issue framing" },
    { lawyer_id, matter_id: m5, type: "statutory", due_date: day(7), basis: "90-day limitation to file SLP (Art. 133)" },
  ]);

  // ── Triage / Inbox (pending court updates + one snoozed) ──────────────────
  await supabase.from("triage_items").insert([
    { lawyer_id, matter_id: m1, kind: "order_uploaded", summary: "New interim order uploaded on eCourts", state: "pending" },
    { lawyer_id, matter_id: m2, kind: "hearing_date_changed", summary: "Hearing listed for " + day(9), state: "pending" },
    { lawyer_id, matter_id: m2, kind: "status_changed", summary: "Case status changed: Fresh → Pending", state: "pending" },
    { lawyer_id, matter_id: m4, kind: "order_uploaded", summary: "Amended plaint accepted on record", state: "pending" },
    { lawyer_id, matter_id: m3, kind: "status_changed", summary: "Petition admitted by NCLT", state: "pending", snoozed_until: at(2) },
  ]);

  // ── Labels (created last so a label issue can't block the core seed) ──────
  const lUrgent = await addLabel("Urgent", "#ef4444");
  const lFiling = await addLabel("Filing", "#3b82f6");
  const lAwaitClient = await addLabel("Awaiting client", "#f59e0b");
  const lAppeal = await addLabel("Appeal", "#8b5cf6");
  const lRetainer = await addLabel("Retainer", "#10b981");

  // ── Label assignments (matters + a few tasks); skip any that didn't resolve ─
  const matterLabels = [
    { matter_id: m1, label_id: lUrgent },
    { matter_id: m1, label_id: lRetainer },
    { matter_id: m2, label_id: lFiling },
    { matter_id: m2, label_id: lAwaitClient },
    { matter_id: m3, label_id: lRetainer },
    { matter_id: m4, label_id: lUrgent },
    { matter_id: m5, label_id: lAppeal },
  ]
    .map(({ matter_id, label_id }) => ({ lawyer_id, matter_id, label_id }))
    .filter((r): r is { lawyer_id: string; matter_id: string; label_id: string } => !!r.label_id);
  if (matterLabels.length) await supabase.from("matter_labels").insert(matterLabels);

  const actionLabels = [
    { key: "DEMO-A1", label_id: lUrgent },
    { key: "DEMO-A1", label_id: lFiling },
    { key: "DEMO-A5", label_id: lFiling },
    { key: "DEMO-A8", label_id: lUrgent },
    { key: "DEMO-A9", label_id: lFiling },
    { key: "DEMO-A9", label_id: lAppeal },
  ]
    .map(({ key, label_id }) => ({ lawyer_id, action_id: actionId(key), label_id }))
    .filter((r): r is { lawyer_id: string; action_id: string; label_id: string } => !!r.action_id && !!r.label_id);
  if (actionLabels.length) await supabase.from("action_labels").insert(actionLabels);

  // ── A genuinely live eCourts case (demo D2) ───────────────────────────────
  // Seed one matter backed by a real, public CNR and sync it for real, so the
  // demo shows an authentic eCourts connection — not a fabricated timeline.
  // Best-effort + key-gated; if the key/credits are absent the demo just omits it.
  if (process.env.ECOURTS_API_KEY) {
    const REAL_CNR = "MPHC030045132023"; // real, public, pending High Court case
    try {
      const res = await getCase(REAL_CNR);
      if (res.ok) {
        const n = normalizeCase(res.data, await getEnums());
        const title =
          [n.petitioners[0], n.respondents[0]].filter(Boolean).join(" vs ") || "Live eCourts case";
        const mReal = await addMatter({
          key: "DEMO-7",
          cnr: REAL_CNR,
          forum_type: n.forum_type ?? "high_court",
          case_type: n.case_type,
          title,
          parties: { petitioners: n.petitioners, respondents: n.respondents },
          court_status: n.court_status,
          matter_status: "active",
          lifecycle_state: "active",
          next_hearing_date: n.next_hearing_date,
          client_id: cMbecl,
          engagement_id: eMbecl,
        });
        await syncMatter(supabase, { id: mReal, lawyer_id, court_status: null, next_hearing_date: null }, n);
      }
    } catch {
      /* live sync is best-effort — the rest of the demo stands without it */
    }
  }

  revalidatePath("/", "layout");
  redirect("/home");
}

async function clearDemo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lawyerId: string,
) {
  // Deleting matters cascades to their hearings, events, remarks, actions,
  // deadlines, triage, and label-join rows; clients and demo labels are removed
  // separately. Real labels of the same name are an accepted edge case.
  await supabase.from("matters").delete().eq("lawyer_id", lawyerId).like("key", "DEMO-%");
  await supabase.from("clients").delete().eq("lawyer_id", lawyerId).eq("notes", DEMO_CLIENT_TAG);
  await supabase.from("labels").delete().eq("lawyer_id", lawyerId).in("name", DEMO_LABEL_NAMES);
}

// Removes the demo data (used by the "see it in action" toggle when turned off).
export async function clearSampleData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await clearDemo(supabase, user.id);
  revalidatePath("/", "layout");
}
