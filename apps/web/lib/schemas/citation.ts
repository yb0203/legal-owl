// The tiered Citation model (record-ref | span-ref) plus the `citations` ledger
// row shape. Mirrors SPEC §3 exactly: this same CitationRef shape is shared by
// the `citations` table (flattened columns), `messages.metadata.claims`, and
// `apps/web/lib/types.ts`. Downstream modules (lib/agents/citations.ts, when
// built) should import CitationRefSchema rather than redefine it.

import { z } from "zod";

// ── Enums ─────────────────────────────────────────────────────────────────────
export const CITATION_RECORD_TABLES = [
  "fact",
  "activity",
  "task",
  "document",
  "matter",
] as const;
export const CitationRecordTableEnum = z.enum(CITATION_RECORD_TABLES);
export type CitationRecordTable = z.infer<typeof CitationRecordTableEnum>;

export const CITATION_REF_KINDS = ["record", "span"] as const;
export const CitationRefKindEnum = z.enum(CITATION_REF_KINDS);
export type CitationRefKind = z.infer<typeof CitationRefKindEnum>;

export const CITATION_SUBJECTS = [
  "message",
  "fact",
  "activity",
  "task",
  "task_step",
] as const;
export const CitationSubjectEnum = z.enum(CITATION_SUBJECTS);
export type CitationSubject = z.infer<typeof CitationSubjectEnum>;

// ── Tiered CitationRef: record-ref | span-ref ────────────────────────────────

/** record-ref: points at a whole row in a citable table. */
const RecordRefObject = z.object({
  kind: z.literal("record"),
  table: CitationRecordTableEnum,
  id: z.uuid(),
});
export const RecordRefSchema = RecordRefObject;
export type RecordRef = z.infer<typeof RecordRefSchema>;

/** span-ref: points at a char-offset range inside a document's extracted text. */
const SpanRefObject = z.object({
  kind: z.literal("span"),
  document_id: z.uuid(),
  start_offset: z.number().int().nonnegative(),
  end_offset: z.number().int().positive(),
});
export const SpanRefSchema = SpanRefObject.refine(
  (ref) => ref.end_offset > ref.start_offset,
  { message: "end_offset must be greater than start_offset", path: ["end_offset"] },
);
export type SpanRef = z.infer<typeof SpanRefSchema>;

/** CitationRef = RecordRef | SpanRef — the ground-truth discriminated union. */
export const CitationRefSchema = z
  .discriminatedUnion("kind", [RecordRefObject, SpanRefObject])
  .refine((ref) => ref.kind !== "span" || ref.end_offset > ref.start_offset, {
    message: "end_offset must be greater than start_offset",
    path: ["end_offset"],
  });
export type CitationRef = z.infer<typeof CitationRefSchema>;

// ── `citations` ledger row (flattened union — queryable/indexable) ──────────
export const CitationSchema = z
  .object({
    id: z.uuid(),
    lawyer_id: z.uuid(),
    matter_id: z.uuid(),
    subject_type: CitationSubjectEnum,
    // Polymorphic, no FK (taggings pattern) — ownership via RLS + app guard.
    subject_id: z.uuid(),
    claim_id: z.uuid(),
    position: z.number().int().nonnegative().default(0),
    ref_kind: CitationRefKindEnum,
    ref_table: CitationRecordTableEnum.nullable().default(null),
    ref_id: z.uuid().nullable().default(null),
    document_id: z.uuid().nullable().default(null),
    start_offset: z.number().int().nonnegative().nullable().default(null),
    end_offset: z.number().int().positive().nullable().default(null),
    quote: z.string().nullable().default(null),
    created_at: z.iso.datetime(),
  })
  .refine(
    (row) =>
      (row.ref_kind === "record" &&
        row.ref_table !== null &&
        row.ref_id !== null &&
        row.document_id === null &&
        row.start_offset === null &&
        row.end_offset === null) ||
      (row.ref_kind === "span" &&
        row.document_id !== null &&
        row.start_offset !== null &&
        row.end_offset !== null &&
        row.end_offset > row.start_offset &&
        row.ref_table === null &&
        row.ref_id === null),
    {
      message:
        "record-ref rows require ref_table/ref_id (and no span fields); " +
        "span-ref rows require document_id/start_offset/end_offset (and no record fields)",
      path: ["ref_kind"],
    },
  );
export type Citation = z.infer<typeof CitationSchema>;

// ── Message claim map (messages.metadata.claims — joins text ranges to citations.claim_id) ──
export const MessageClaimSchema = z.object({
  claim_id: z.uuid(),
  part: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
});
export type MessageClaim = z.infer<typeof MessageClaimSchema>;

export const MessageClaimMapSchema = z.object({
  claims: z.array(MessageClaimSchema).optional(),
});
export type MessageClaimMap = z.infer<typeof MessageClaimMapSchema>;
