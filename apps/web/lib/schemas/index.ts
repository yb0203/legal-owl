// Re-exports for the grounding-layer schema module (SPEC: facts, acts/checks,
// citations, playbook). Import from "@/lib/schemas" for the full surface, or
// from an individual file for a narrower import.

export * from "./provenance";
export * from "./citation";
export * from "./fact";
export * from "./act";
export * from "./check";
export * from "./proposal";
export * from "./playbook";

// Convenience: task_steps is one table, two kinds ('act' | 'check') that share
// lifecycle/ordering/rendering. This union is not itself a locked-spec entity;
// it's a composition of act.ts + check.ts for callers that want to handle a
// task's steps generically.
import { z } from "zod";
import { ActStepSchema } from "./act";
import { CheckStepSchema } from "./check";

export const TaskStepSchema = z.discriminatedUnion("kind", [
  ActStepSchema,
  CheckStepSchema,
]);
export type TaskStep = z.infer<typeof TaskStepSchema>;
