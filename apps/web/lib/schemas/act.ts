// `task_steps` where kind = 'act' — a do-step under a task (SPEC §2).
// Acts and checks share one DB table; this schema models the "act" species
// (completed_at is meaningful; `result`/`evaluated_at` are check-only and
// are intentionally absent here — see check.ts and the DB check constraint
// `(kind = 'act' and result is null) or kind = 'check'`).

import { z } from "zod";
import { StepSourceEnum } from "./provenance";

export const ActStepSchema = z.object({
  id: z.uuid(),
  lawyer_id: z.uuid(),
  task_id: z.uuid(),
  kind: z.literal("act"),
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  // Manual ordering within task + kind.
  position: z.number().int().default(0),
  // null = open.
  completed_at: z.iso.datetime().nullable().default(null),
  source: StepSourceEnum.default("manual"),
  playbook_item_id: z.uuid().nullable().default(null),
  source_note: z.string().nullable().default(null),
  created_at: z.iso.datetime(),
});
export type ActStep = z.infer<typeof ActStepSchema>;
