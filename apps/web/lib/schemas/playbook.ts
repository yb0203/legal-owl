// `playbook_items` — layered State | Firm | Personal repo of rules, checklists,
// and templates (SPEC §4). One table, three kinds; payloads are high-variance
// so `spec` is a kind-discriminated union (PlaybookRuleSpec | ChecklistSpec |
// TemplateSpec).
//
// `forum_type` / `task_type` are applicability filters reusing the existing
// canonical enums from lib/types.ts (FORUM_TYPES / TASK_TYPES) rather than
// redefining them — those are established entities, not new to this spec.

import { z } from "zod";
import { FORUM_TYPES, TASK_TYPES } from "@/lib/types";

const ForumTypeEnum = z.enum(FORUM_TYPES);
const TaskTypeEnum = z.enum(TASK_TYPES);

// ── Enums ─────────────────────────────────────────────────────────────────────
export const PLAYBOOK_SCOPES = ["state", "firm", "personal"] as const;
export const PlaybookScopeEnum = z.enum(PLAYBOOK_SCOPES);
export type PlaybookScope = z.infer<typeof PlaybookScopeEnum>;

export const PLAYBOOK_KINDS = ["rule", "checklist", "template"] as const;
export const PlaybookKindEnum = z.enum(PLAYBOOK_KINDS);
export type PlaybookKind = z.infer<typeof PlaybookKindEnum>;

// ── `spec` payload shapes (discriminated by kind) ────────────────────────────

/** Deterministic; feeds the rule engine. */
export const PlaybookRuleSpecSchema = z.object({
  kind: z.literal("rule"),
  // Condition tree over task/matter/fact fields.
  when: z.record(z.string(), z.unknown()),
  // Effects: create deadline task, set priority, raise check, …
  then: z.record(z.string(), z.unknown()),
});
export type PlaybookRuleSpec = z.infer<typeof PlaybookRuleSpecSchema>;

/** Default acts/checks fanned into task_steps on apply. */
export const PlaybookChecklistSpecSchema = z.object({
  kind: z.literal("checklist"),
  acts: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
    }),
  ),
  checks: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      source_note: z.string().optional(),
    }),
  ),
});
export type PlaybookChecklistSpec = z.infer<typeof PlaybookChecklistSpecSchema>;

/** Draft template. */
export const PlaybookTemplateSpecSchema = z.object({
  kind: z.literal("template"),
  format: z.literal("markdown"),
  body: z.string().min(1),
  // e.g. ['matter.title', 'client.display_name']
  variables: z.array(z.string()),
});
export type PlaybookTemplateSpec = z.infer<typeof PlaybookTemplateSpecSchema>;

export const PlaybookSpecSchema = z.discriminatedUnion("kind", [
  PlaybookRuleSpecSchema,
  PlaybookChecklistSpecSchema,
  PlaybookTemplateSpecSchema,
]);
export type PlaybookSpec = z.infer<typeof PlaybookSpecSchema>;

// ── `playbook_items` row ──────────────────────────────────────────────────────
export const PlaybookItemSchema = z
  .object({
    id: z.uuid(),
    scope: PlaybookScopeEnum,
    // null iff scope === 'state' (global/system rows, workflow_states pattern).
    lawyer_id: z.uuid().nullable(),
    // Forward slot, no FK yet (no firms table). Firm rows are owned by their
    // creating lawyer until firms exist.
    firm_id: z.uuid().nullable().default(null),
    kind: PlaybookKindEnum,
    // Stable identity across layers — the override chain key.
    slug: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable().default(null),
    forum_type: ForumTypeEnum.nullable().default(null),
    task_type: TaskTypeEnum.nullable().default(null),
    spec: PlaybookSpecSchema,
    // Authority citation for state rows, e.g. "Limitation Act, 1963 §12(2)".
    source_ref: z.string().nullable().default(null),
    // Disable without delete — a disabled personal row still shadows lower layers.
    enabled: z.boolean().default(true),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
  })
  .refine((item) => (item.scope === "state") === (item.lawyer_id === null), {
    message: "lawyer_id must be null if and only if scope === 'state'",
    path: ["lawyer_id"],
  })
  .refine((item) => item.kind === item.spec.kind, {
    message: "spec.kind must match kind",
    path: ["spec"],
  });
export type PlaybookItem = z.infer<typeof PlaybookItemSchema>;
