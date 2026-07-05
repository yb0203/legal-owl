// Input-schema registry — the one place agent input contracts live in code
// (zod can't live in YAML). A YAML def references a schema here by key
// (`input: limitation-clerk`); the loader resolves it to the real zod schema so
// defineAgent's boundary parse still applies.

import { z } from "zod";

/** A date-typed `facts` slice the Limitation Clerk reasons over. */
export const DateBearingFactSchema = z.object({
  fact_id: z.uuid(),
  document_id: z.uuid(),
  fact_type: z.string().min(1),
  /** ISO yyyy-mm-dd — mirrors the `date` variant of FactValue. */
  date: z.iso.date(),
  start_offset: z.number().int().nonnegative(),
  end_offset: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
});

export const AGENT_INPUTS = {
  "intake-registrar": z.object({
    matter_id: z.uuid(),
    document_id: z.uuid(),
  }),
  "limitation-clerk": z.object({
    matter_id: z.uuid(),
    forum_type: z
      .enum([
        "district",
        "high_court",
        "supreme_court",
        "nclt",
        "nclat",
        "arbitration",
        "tribunal",
        "other",
      ])
      .optional(),
    facts: z.array(DateBearingFactSchema).min(1),
  }),
  "court-scout": z.object({
    matter_id: z.uuid(),
    activity_ids: z.array(z.uuid()),
  }),
} satisfies Record<string, z.ZodType>;

export type AgentInputName = keyof typeof AGENT_INPUTS;

export function getInputSchema(name: string): z.ZodType {
  const schema = (AGENT_INPUTS as Record<string, z.ZodType>)[name];
  if (!schema) {
    throw new Error(
      `Unknown agent input schema: "${name}" — add it to lib/agents/inputs.ts`,
    );
  }
  return schema;
}
