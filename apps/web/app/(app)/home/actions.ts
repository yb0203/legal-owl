"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCase, getEnums } from "@/lib/ecourts/client";
import { normalizeCase } from "@/lib/ecourts/normalize";
import { syncMatter } from "@/lib/ecourts/sync";
import { ask, emitProposal } from "@/lib/agents/orchestrator";
import { createProposal } from "@/lib/agents/proposal";
import { resolveSpan } from "@/lib/facts/resolve-span";

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
  const triage = sid("Triage");

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

  // ── Clients ───────────────────────────────────────────────────────────────
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
  });

  // ── Hearings (past held + upcoming scheduled) — tasks of type='hearing' ────
  const hearing = (matter_id: string, d: string, purpose: string, court_state: string, outcome?: string) => ({
    lawyer_id, matter_id, type: "hearing", title: purpose, due_date: d, source: "sync",
    attributes: { purpose, outcome: outcome ?? null, court_state },
  });
  await supabase.from("tasks").insert([
    hearing(m1, day(3), "Arguments on interim relief", "scheduled"),
    hearing(m1, day(18), "Final arguments", "scheduled"),
    hearing(m1, day(-22), "Filing of reply", "held", "Adjourned"),
    hearing(m2, day(9), "Hearing on bail application", "scheduled"),
    hearing(m2, day(-30), "Notice to respondents", "held", "Notice issued"),
    hearing(m3, day(24), "Constitution of Committee of Creditors", "scheduled"),
    hearing(m4, day(1), "Framing of issues", "scheduled"),
    hearing(m4, day(-40), "Filing of written statement", "held", "WS taken on record"),
    hearing(m6, day(-60), "Final hearing", "held", "Complaint allowed"),
  ]);

  // ── Court events (full range of event types) — activity kind='court_event' ─
  const ce = (matter_id: string, event_type: string, new_value: string, at_: string, content_hash: string, previous_value?: string) => ({
    lawyer_id, matter_id, kind: "court_event", event_type, new_value, previous_value: previous_value ?? null,
    occurred_at: at_, source: "ecourt", content_hash,
  });
  await supabase.from("activity").insert([
    ce(m1, "judge_changed", "Bench reconstituted", at(-12), "demo-m1-e1"),
    ce(m1, "order_uploaded", "Interim order uploaded", at(-8), "demo-m1-e2"),
    ce(m1, "hearing_date_changed", day(3), at(-6), "demo-m1-e3", day(-2)),
    ce(m1, "document_added", "Respondent's reply uploaded", at(-4), "demo-m1-e4"),
    ce(m2, "status_changed", "Pending", at(-15), "demo-m2-e1", "Fresh"),
    ce(m2, "order_uploaded", "Order on bail application uploaded", at(-3), "demo-m2-e2"),
    ce(m3, "status_changed", "Admitted", at(-20), "demo-m3-e1", "Fresh"),
    ce(m4, "hearing_date_changed", day(1), at(-5), "demo-m4-e1", day(-7)),
    ce(m4, "document_added", "Amended plaint uploaded", at(-2), "demo-m4-e2"),
    ce(m6, "order_uploaded", "Final order uploaded", at(-55), "demo-m6-e1"),
    ce(m6, "status_changed", "Disposed", at(-55), "demo-m6-e2", "Pending"),
  ]);

  // ── Remarks (lawyer's own notes) — activity kind='remark' ─────────────────
  const remark = (matter_id: string, body: string, at_: string) => ({
    lawyer_id, matter_id, kind: "remark", body, source: "lawyer_manual", occurred_at: at_,
  });
  await supabase.from("activity").insert([
    remark(m1, "Client informed of the new hearing date. Rejoinder to be filed before the next date.", at(-5)),
    remark(m1, "Senior counsel briefed; rejoinder draft circulated for review.", at(-2)),
    remark(m2, "Client to provide updated medical documents before the next date.", at(-1)),
    remark(m3, "Section 9 petition admitted. Awaiting constitution of CoC.", at(-3)),
    remark(m4, "Defendant likely to seek adjournment; oppose and press for issue framing.", at(-1)),
    remark(m5, "SLP drafted; to be filed this week. Awaiting eCourts listing after filing.", at(-1)),
    remark(m6, "Complaint allowed; compensation awarded to client. Matter closed.", at(-50)),
  ]);

  // ── Tasks (overdue / today / upcoming, varied states) — type='task' ───────
  const { data: actionRows } = await supabase
    .from("tasks")
    .insert([
      { lawyer_id, matter_id: m1, type: "task", key: "DEMO-A1", title: "File rejoinder to respondent's reply", state_id: inProgress, priority: "high", due_date: day(2), source: "manual" },
      { lawyer_id, matter_id: m1, type: "task", key: "DEMO-A2", title: "Brief senior counsel for arguments", state_id: todo, priority: "medium", due_date: day(2), source: "manual" },
      { lawyer_id, matter_id: m1, type: "task", key: "DEMO-A3", title: "Pay arbitral tribunal fee", state_id: awaitingFiling, priority: "low", due_date: day(5), source: "manual" },
      { lawyer_id, matter_id: m2, type: "task", key: "DEMO-A4", title: "Collect medical records from client", state_id: blocked, priority: "medium", due_date: day(6), source: "manual" },
      { lawyer_id, matter_id: m2, type: "task", key: "DEMO-A5", title: "Draft bail application", state_id: todo, priority: "high", due_date: day(0), source: "manual" },
      { lawyer_id, matter_id: m3, type: "task", key: "DEMO-A6", title: "Verify claims received from creditors", state_id: todo, priority: "low", source: "manual" },
      { lawyer_id, matter_id: m4, type: "task", key: "DEMO-A7", title: "Prepare for issue framing", state_id: inProgress, priority: "high", due_date: day(0), source: "manual" },
      { lawyer_id, matter_id: m4, type: "task", key: "DEMO-A8", title: "Serve amended plaint on defendant", state_id: todo, priority: "urgent", due_date: day(-3), source: "manual" },
      { lawyer_id, matter_id: m5, type: "task", key: "DEMO-A9", title: "Finalise SLP paper-book", state_id: awaitingFiling, priority: "high", due_date: day(2), source: "manual" },
      { lawyer_id, matter_id: m6, type: "task", key: "DEMO-A10", title: "Send closure note to client", state_id: done, priority: "none", source: "manual", completed_at: at(-48) },
    ])
    .select("id, key");
  const actionId = (key: string) => actionRows?.find((a) => a.key === key)?.id as string | undefined;

  // ── Deadlines (rule-bearing dates, incl. an overdue limitation) — type='deadline' ─
  const deadline = (matter_id: string, deadline_type: string, d: string, basis: string) => ({
    lawyer_id, matter_id, type: "deadline", title: basis, due_date: d, source: "manual",
    attributes: { deadline_type, basis },
  });
  await supabase.from("tasks").insert([
    deadline(m1, "internal", day(1), "Rejoinder to be filed"),
    deadline(m1, "statutory", day(6), "Window to file objections to interim order"),
    deadline(m2, "limitation", day(4), "Limitation to file revision petition"),
    deadline(m4, "limitation", day(-1), "Limitation for written statement (CPC Order VIII)"),
    deadline(m4, "internal", day(3), "Compile documents for issue framing"),
    deadline(m5, "statutory", day(7), "90-day limitation to file SLP (Art. 133)"),
  ]);

  // ── Triage / Inbox — type='task' parked in the Triage state ───────────────
  const triageTask = (matter_id: string, triage_kind: string, summary: string, snoozed_until?: string) => ({
    lawyer_id, matter_id, type: "task", state_id: triage, title: summary, source: "triage",
    attributes: { triage_kind }, snoozed_until: snoozed_until ?? null,
  });
  await supabase.from("tasks").insert([
    triageTask(m1, "order_uploaded", "New interim order uploaded on eCourts"),
    triageTask(m2, "hearing_date_changed", "Hearing listed for " + day(9)),
    triageTask(m2, "status_changed", "Case status changed: Fresh → Pending"),
    triageTask(m4, "order_uploaded", "Amended plaint accepted on record"),
    triageTask(m3, "status_changed", "Petition admitted by NCLT", at(2)),
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
    .map(({ matter_id, label_id }) => ({ lawyer_id, target_type: "matter", target_id: matter_id, label_id }))
    .filter((r): r is { lawyer_id: string; target_type: string; target_id: string; label_id: string } => !!r.label_id);
  if (matterLabels.length) await supabase.from("taggings").insert(matterLabels);

  const actionLabels = [
    { key: "DEMO-A1", label_id: lUrgent },
    { key: "DEMO-A1", label_id: lFiling },
    { key: "DEMO-A5", label_id: lFiling },
    { key: "DEMO-A8", label_id: lUrgent },
    { key: "DEMO-A9", label_id: lFiling },
    { key: "DEMO-A9", label_id: lAppeal },
  ]
    .map(({ key, label_id }) => ({ lawyer_id, target_type: "task", target_id: actionId(key), label_id }))
    .filter((r): r is { lawyer_id: string; target_type: string; target_id: string; label_id: string } => !!r.target_id && !!r.label_id);
  if (actionLabels.length) await supabase.from("taggings").insert(actionLabels);

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
        });
        await syncMatter(supabase, { id: mReal, lawyer_id, court_status: null, next_hearing_date: null }, n);
      }
    } catch {
      /* live sync is best-effort — the rest of the demo stands without it */
    }
  }

  revalidatePath("/", "layout");
  redirect("/home?tour=1");
}

async function clearDemo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lawyerId: string,
) {
  // taggings is polymorphic (no FK on target_id), so a matter delete won't
  // cascade to its matter/task taggings — clear them explicitly first.
  const { data: demoMatters } = await supabase
    .from("matters")
    .select("id")
    .eq("lawyer_id", lawyerId)
    .like("key", "DEMO-%");
  const matterIds = (demoMatters ?? []).map((m) => m.id as string);
  if (matterIds.length) {
    const { data: demoTasks } = await supabase.from("tasks").select("id").in("matter_id", matterIds);
    const taskIds = (demoTasks ?? []).map((t) => t.id as string);
    if (taskIds.length) {
      await supabase.from("taggings").delete().eq("target_type", "task").in("target_id", taskIds);
    }
    await supabase.from("taggings").delete().eq("target_type", "matter").in("target_id", matterIds);
  }
  // Deleting matters cascades to their tasks (hearings/deadlines/triage included)
  // and activity rows; clients and demo labels are removed separately. Real
  // labels of the same name are an accepted edge case.
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

// ── Demo: the agentic loop end-to-end ────────────────────────────────────────
// Reads a demo court order with the (free-model) Intake Registrar and files its
// span-cited fact proposal into the Inbox. Approving it there
// (app/(app)/inbox/actions.ts#acceptTriageItem) executes fact.create → a verified
// fact on the matter. This is the whole approve-before-act loop in one click.
const SHARMA_ORDER = `IN THE HIGH COURT OF DELHI AT NEW DELHI
W.P.(CRL) 234 of 2025
Rakesh Sharma ... Petitioner
versus
State of Delhi ... Respondent
ORDER dated 15.07.2025
Issue notice to the respondent. The petitioner seeks quashing of FIR No. 112 of 2025 registered at P.S. Saket. List the matter on 09.09.2025 for hearing on the bail application. The petitioner shall file the certified copy of the impugned order within thirty days.`;

export async function runDemoIntake() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const lawyer_id = user.id;

  // The demo "Sharma vs State of Delhi" matter (seeded by "See it in action").
  const { data: matter } = await supabase
    .from("matters")
    .select("id")
    .eq("lawyer_id", lawyer_id)
    .eq("key", "DEMO-2")
    .maybeSingle();
  if (!matter) return;

  const DOC_NAME = "Order dated 15-07-2025.pdf";
  let { data: doc } = await supabase
    .from("documents")
    .select("id")
    .eq("matter_id", matter.id)
    .eq("name", DOC_NAME)
    .maybeSingle();
  if (!doc) {
    const inserted = await supabase
      .from("documents")
      .insert({
        lawyer_id,
        matter_id: matter.id,
        name: DOC_NAME,
        storage_path: `${lawyer_id}/${matter.id}/demo-order.txt`,
        mime_type: "text/plain",
        source: "court_order",
      })
      .select("id")
      .single();
    doc = inserted.data;
  }
  if (!doc) return;

  let emitted = 0;
  try {
    const result = await ask(
      "intake-registrar",
      {
        matter_id: matter.id,
        document_id: doc.id,
        document_name: DOC_NAME,
        document_text: SHARMA_ORDER,
      },
      { supabase, user },
    );
    for (const proposal of result.proposals) {
      if (await emitProposal(supabase, lawyer_id, proposal)) emitted++;
    }
  } catch (err) {
    // A free-model rate-limit shouldn't crash the page.
    console.error("[runDemoIntake] intake failed:", err);
  }

  // Demo reliability: free models frequently rate-limit. If the live agent
  // produced nothing, fall back to a deterministic, span-accurate proposal so the
  // approve → fact loop is always demonstrable. Approving it runs the SAME
  // fact.create action and creates a real, verified, span-cited fact.
  if (emitted === 0) {
    const quote = "List the matter on 09.09.2025";
    const span = resolveSpan(SHARMA_ORDER, quote);
    const proposal = createProposal({
      agent: "intake-registrar",
      action: "fact.create",
      args: {
        matter_id: matter.id,
        document_id: doc.id,
        fact_type: "next_hearing_date",
        value_text: "09.09.2025",
        value: { kind: "date", date: "2025-09-09" },
        confidence: 0.95,
        quote,
        start_offset: span?.start ?? 0,
        end_offset: span?.end ?? 1,
      },
      citations: span
        ? [{ kind: "span" as const, document_id: doc.id, start_offset: span.start, end_offset: span.end }]
        : [],
      confidence: 0.95,
      trace: "Next hearing date extracted from the order: “List the matter on 09.09.2025”.",
    });
    await emitProposal(supabase, lawyer_id, proposal);
  }

  revalidatePath("/", "layout");
}
