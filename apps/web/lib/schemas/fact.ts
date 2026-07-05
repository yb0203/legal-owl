// `facts` — extracted, citeable facts with span provenance (SPEC §1).
// A fact is self-citing: its own span IS its citation (see citation.ts's
// SpanRef — project a Fact to a SpanRef via { document_id, start_offset,
// end_offset } once lib/citations.ts exists; not implemented in this schema
// layer per task scope).

import { z } from "zod";
import {
  ConfidenceSchema,
  DocumentSpanShape,
  ExtractorVersionSchema,
  SourceRankSchema,
} from "./provenance";

// ── Enums ─────────────────────────────────────────────────────────────────────
export const FACT_STATUSES = ["proposed", "verified"] as const;
export const FactStatusEnum = z.enum(FACT_STATUSES);
export type FactStatus = z.infer<typeof FactStatusEnum>;

// ── FactValue: canonical typed payload stored in facts.value (jsonb) ─────────
export const FactValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({
    kind: z.literal("number"),
    number: z.number(),
    unit: z.string().optional(),
  }),
  // ISO yyyy-mm-dd
  z.object({ kind: z.literal("date"), date: z.iso.date() }),
  // currency e.g. 'INR'
  z.object({
    kind: z.literal("money"),
    amount: z.number(),
    currency: z.string().min(1),
  }),
  z.object({ kind: z.literal("boolean"), value: z.boolean() }),
]);
export type FactValue = z.infer<typeof FactValueSchema>;

// ── `facts` row ───────────────────────────────────────────────────────────────
export const FactSchema = z
  .object({
    id: z.uuid(),
    lawyer_id: z.uuid(),
    matter_id: z.uuid(),
    ...DocumentSpanShape,
    // Open vocabulary — extractor-driven, will grow (party_name, filing_date, …).
    fact_type: z.string().min(1),
    value: FactValueSchema,
    // Denormalised display string — always renderable, even for unknown fact_type UIs.
    value_text: z.string().min(1),
    confidence: ConfidenceSchema,
    status: FactStatusEnum.default("proposed"),
    verified_at: z.iso.datetime().nullable().default(null),
    source_rank: SourceRankSchema.default(100),
    extractor_version: ExtractorVersionSchema,
    created_at: z.iso.datetime(),
  })
  .refine((fact) => fact.end_offset > fact.start_offset, {
    message: "end_offset must be greater than start_offset",
    path: ["end_offset"],
  });
export type Fact = z.infer<typeof FactSchema>;
