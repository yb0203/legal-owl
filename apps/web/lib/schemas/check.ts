// `task_steps` where kind = 'check' — a QA gate under a task (SPEC §2).
// Acts and checks share one DB table; this schema models the "check" species
// (`result`/`evaluated_at` are meaningful; `completed_at` is act-only and is
// intentionally absent here — see act.ts).

import { z } from "zod";
import { StepSourceEnum } from "./provenance";

export const CHECK_RESULTS = ["pass", "fail", "na"] as const;
export const CheckResultEnum = z.enum(CHECK_RESULTS);
export type CheckResult = z.infer<typeof CheckResultEnum>;

export const CheckStepSchema = z.object({
  id: z.uuid(),
  lawyer_id: z.uuid(),
  task_id: z.uuid(),
  kind: z.literal("check"),
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  // Manual ordering within task + kind.
  position: z.number().int().default(0),
  // null = not yet evaluated.
  result: CheckResultEnum.nullable().default(null),
  evaluated_at: z.iso.datetime().nullable().default(null),
  source: StepSourceEnum.default("manual"),
  playbook_item_id: z.uuid().nullable().default(null),
  source_note: z.string().nullable().default(null),
  created_at: z.iso.datetime(),
});
export type CheckStep = z.infer<typeof CheckStepSchema>;
