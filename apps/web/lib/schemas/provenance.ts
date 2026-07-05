// Shared "how do we know this" primitives reused across the grounding layer:
// document spans (facts, span-refs), confidence scores, source authority ranking,
// extractor versioning, and step provenance (manual | playbook | assistant).
//
// These are building blocks, not standalone DB rows — fact.ts, citation.ts,
// act.ts, check.ts, and proposal.ts compose them rather than redefine them.

import { z } from "zod";

// ── Document span (char-offset range into a document's extracted text) ──────
// Plain field shape (for composing into larger objects, e.g. facts.ts' FactSchema)
// plus a standalone refined schema (for validating a span on its own, e.g. inside
// citation.ts' SpanRef).
export const DocumentSpanShape = {
  document_id: z.uuid(),
  start_offset: z.number().int().nonnegative(),
  end_offset: z.number().int().positive(),
};

export const DocumentSpanSchema = z
  .object(DocumentSpanShape)
  .refine((span) => span.end_offset > span.start_offset, {
    message: "end_offset must be greater than start_offset",
    path: ["end_offset"],
  });
export type DocumentSpan = z.infer<typeof DocumentSpanSchema>;

// ── Confidence score in [0, 1] ────────────────────────────────────────────────
// Shared by facts.confidence and the agent-platform Proposal envelope.
export const ConfidenceSchema = z.number().min(0).max(1);
export type Confidence = z.infer<typeof ConfidenceSchema>;

// ── Source authority ranking (smallint; lower = more authoritative) ─────────
export const SourceRankSchema = z.number().int().min(0).max(32767);
export type SourceRank = z.infer<typeof SourceRankSchema>;

/** Documented reference ranks from SPEC §1 (guidance, not DB-enforced). */
export const SOURCE_RANK = {
  judgement: 10,
  court_order: 20,
  lawyer_upload: 50,
  generated: 90,
} as const;

// ── Extractor version tag, e.g. 'fact-extractor@2026-07-01' ─────────────────
export const ExtractorVersionSchema = z.string().min(1);
export type ExtractorVersion = z.infer<typeof ExtractorVersionSchema>;

// ── Step provenance: how a task_steps row came to exist ──────────────────────
export const STEP_SOURCES = ["manual", "playbook", "assistant"] as const;
export const StepSourceEnum = z.enum(STEP_SOURCES);
export type StepSource = z.infer<typeof StepSourceEnum>;
