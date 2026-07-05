// The default adapter: run the agent's prompt through OpenRouter (host-agnostic
// via config.model), require a strictly-shaped JSON proposal back, and mint it
// through createProposal so a malformed or uncited envelope can never leave.
// This IS the approve-before-act boundary — the adapter proposes; it never writes.

import { z } from "zod";
import { createProposal } from "@/lib/agents/proposal";
import { CitationRefSchema } from "@/lib/schemas";
import { complete } from "@/lib/ai/openrouter";
import type { AgentAdapter } from "@/lib/agents/adapters/types";
import type { AgentConfig } from "@/lib/agents/config";

/** What the model must return. The agent name / proposal id / dedupe_key are
 *  minted server-side by createProposal — never trusted from the model. */
const ModelProposalSchema = z.object({
  action: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  citations: z.array(CitationRefSchema).default([]),
  confidence: z.number().min(0).max(1),
  trace: z.string().optional(),
});

function protocol(config: AgentConfig): string {
  const actions =
    config.actions.length > 0
      ? config.actions.map((a) => `"${a}"`).join(", ")
      : "(no actions configured — you may only abstain)";
  return [
    "Respond with a SINGLE JSON object and nothing else. Shape:",
    '{ "action": string, "args": object, "citations": CitationRef[], "confidence": number, "trace": string }',
    `- "action" MUST be one of: ${actions}.`,
    '- "args" MUST include "matter_id" plus only the fields the action needs.',
    '- "citations" is an array of {"kind":"record","table":"fact|activity|task|document|matter","id":"<uuid>"} OR {"kind":"span","document_id":"<uuid>","start_offset":<int>,"end_offset":<int>}.',
    "- Every factual claim in args/trace MUST be backed by a citation drawn from the provided context. If you cannot cite it from the record, DO NOT assert it.",
    "- If the record does not support any grounded proposal, return confidence 0 and an empty citations array (the system will drop it).",
    '- "confidence" is 0..1. "trace" is a short human-readable explanation of the reasoning.',
  ].join("\n");
}

export const openrouterAdapter: AgentAdapter = {
  name: "openrouter",
  async run(config, input, ctx) {
    const content = await complete({
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.max_tokens,
      json: true,
      signal: ctx.signal,
      messages: [
        { role: "system", content: `${config.system}\n\n${protocol(config)}` },
        { role: "user", content: JSON.stringify({ input }, null, 2) },
      ],
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`agent "${config.name}": model did not return valid JSON`);
    }

    const out = ModelProposalSchema.parse(parsed);
    if (config.actions.length > 0 && !config.actions.includes(out.action)) {
      throw new Error(
        `agent "${config.name}": proposed action "${out.action}" is not in its allowed actions`,
      );
    }

    // Deterministic span offsets. LLMs cannot count characters reliably, so when
    // the caller passed the source text and the model returned a verbatim `quote`,
    // compute the real offsets by searching the document — accurate by construction
    // (the offsets the model itself emits are discarded). See
    // docs/design/agent-architecture.md and the LlamaIndex citation pattern.
    const docText = (input as { document_text?: unknown } | null)?.document_text;
    const args = out.args as Record<string, unknown>;
    if (typeof docText === "string" && typeof args.quote === "string" && args.quote.length > 0) {
      const idx = docText.indexOf(args.quote);
      if (idx >= 0) {
        const start = idx;
        const end = idx + args.quote.length;
        args.start_offset = start;
        args.end_offset = end;
        for (const cite of out.citations) {
          if (cite.kind === "span") {
            cite.start_offset = start;
            cite.end_offset = end;
          }
        }
      }
    }

    const proposal = createProposal({
      agent: config.name,
      action: out.action,
      args: out.args,
      citations: out.citations,
      confidence: out.confidence,
      trace: out.trace,
    });
    return { output: proposal, proposals: [proposal] };
  },
};
