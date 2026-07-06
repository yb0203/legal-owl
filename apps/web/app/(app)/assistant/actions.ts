"use server";

import { createClient } from "@/lib/supabase/server";
import { getSystemStateId } from "@/lib/db";
import { complete } from "@/lib/ai/openrouter";
import { acceptTriageItem, dismissTriageItem } from "@/app/(app)/inbox/actions";

const MODEL = "openrouter/free"; // free model for the demo

export interface AssistScope {
  matterId: string | null;
  title: string | null;
  cnr: string | null;
}
export interface AssistProposal {
  id: string;
  agent: string;
  action: string;
  summary: string;
  trace: string | null;
}
export interface OwlAnswer {
  answer: string;
  sources: string[];
  abstained: boolean;
}

/** The scope chip (current matter + CNR) and the pending Owl proposals for it. */
export async function getAssistData(
  matterId: string | null,
): Promise<{ scope: AssistScope; proposals: AssistProposal[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { scope: { matterId, title: null, cnr: null }, proposals: [] };

  let scope: AssistScope = { matterId, title: null, cnr: null };
  if (matterId) {
    const { data: m } = await supabase
      .from("matters")
      .select("title, cnr")
      .eq("id", matterId)
      .maybeSingle();
    if (m) scope = { matterId, title: (m.title as string) ?? null, cnr: (m.cnr as string) ?? null };
  }

  const triageId = await getSystemStateId(supabase, "Triage");
  let q = supabase
    .from("tasks")
    .select("id, matter_id, attributes")
    .eq("type", "task")
    .eq("state_id", triageId ?? "")
    .eq("source", "agent");
  if (matterId) q = q.eq("matter_id", matterId);
  const { data: rows } = await q.limit(20);

  const proposals: AssistProposal[] = (rows ?? [])
    .map((r) => {
      const p = (r.attributes as { proposal?: { agent?: string; action?: string; trace?: string } } | null)?.proposal;
      if (!p?.action) return null;
      return {
        id: r.id as string,
        agent: p.agent ?? "owl",
        action: p.action,
        summary: p.trace?.split("\n")[0] ?? `${p.agent ?? "Owl"}: ${p.action}`,
        trace: p.trace ?? null,
      };
    })
    .filter((p): p is AssistProposal => p !== null);

  return { scope, proposals };
}

/** Grounded Q&A over the case record. Answers ONLY from the record, or abstains. */
export async function askOwl(matterId: string | null, question: string): Promise<OwlAnswer> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { answer: "Please sign in.", sources: [], abstained: true };
  if (!question.trim()) return { answer: "", sources: [], abstained: true };

  const ctx: string[] = [];
  if (matterId) {
    const { data: m } = await supabase
      .from("matters")
      .select("title, cnr, court_status, next_hearing_date")
      .eq("id", matterId)
      .maybeSingle();
    if (m)
      ctx.push(
        `MATTER: ${m.title} | CNR ${m.cnr ?? "—"} | status ${m.court_status ?? "—"} | next hearing ${m.next_hearing_date ?? "—"}`,
      );
    const { data: acts } = await supabase
      .from("activity")
      .select("kind, event_type, body, new_value, occurred_at")
      .eq("matter_id", matterId)
      .order("occurred_at", { ascending: false })
      .limit(30);
    for (const a of acts ?? [])
      ctx.push(`ACTIVITY [${(a.occurred_at as string)?.slice(0, 10)}] ${a.event_type ?? a.kind}: ${a.new_value ?? a.body ?? ""}`);
    const { data: facts } = await supabase
      .from("facts")
      .select("fact_type, value_text, status")
      .eq("matter_id", matterId)
      .limit(40);
    for (const f of facts ?? []) ctx.push(`FACT ${f.fact_type}: ${f.value_text} (${f.status})`);
    const { data: tasks } = await supabase
      .from("tasks")
      .select("type, title, due_date")
      .eq("matter_id", matterId)
      .limit(30);
    for (const t of tasks ?? [])
      ctx.push(`${(t.type as string).toUpperCase()}: ${t.title}${t.due_date ? " (due " + t.due_date + ")" : ""}`);
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const { data: up } = await supabase
      .from("tasks")
      .select("type, title, due_date")
      .in("type", ["hearing", "deadline"])
      .gte("due_date", today)
      .order("due_date")
      .limit(20);
    for (const t of up ?? []) ctx.push(`${(t.type as string).toUpperCase()}: ${t.title} (due ${t.due_date})`);
  }

  if (ctx.length === 0)
    return {
      answer: "There's nothing on this matter's record yet — add documents or notes and I'll answer from them.",
      sources: [],
      abstained: true,
    };

  const system =
    'You are Owl, an assistant for an Indian litigator. Answer ONLY from the CASE RECORD provided. If the record does not contain the answer, set abstained=true and say "That is not on the record before me" plus what to add — never guess or use outside knowledge. Be concise and practical. Return ONLY a JSON object: { "answer": string, "sources": string[] (the exact record lines you relied on), "abstained": boolean }.';
  const userMsg = `CASE RECORD:\n${ctx.join("\n")}\n\nQUESTION: ${question}`;

  let content: string;
  try {
    content = await complete({
      model: MODEL,
      json: true,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
    });
  } catch {
    return { answer: "I couldn't reach the model just now — please try again.", sources: [], abstained: true };
  }

  try {
    const p = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? content);
    return {
      answer: String(p.answer ?? ""),
      sources: Array.isArray(p.sources) ? p.sources.map(String) : [],
      abstained: !!p.abstained,
    };
  } catch {
    return { answer: content.slice(0, 800), sources: [], abstained: false };
  }
}

/** Approve an Owl proposal (executes its typed action via the Inbox accept flow). */
export async function approveProposal(id: string): Promise<void> {
  const fd = new FormData();
  fd.set("item_id", id);
  await acceptTriageItem(fd);
}

/** Dismiss an Owl proposal. */
export async function dismissProposal(id: string): Promise<void> {
  await dismissTriageItem(id);
}
