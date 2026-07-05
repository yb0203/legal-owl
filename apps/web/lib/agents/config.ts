// The declarative agent contract — the shape of every YAML file in
// lib/agents/defs/. An agent is CONFIG (model, prompt, trigger, which input
// schema, which actions it may propose); its runtime behaviour comes from an
// adapter (lib/agents/adapters/*), so swapping OpenRouter for Lyzr / CrewAI is a
// config + adapter change, never an agent rewrite.

import { z } from "zod";

export const AgentTriggerEnum = z.enum(["ambient", "on_demand", "sidebar"]);

/** Must stay in sync with orchestrator.ts's AmbientEvent union and
 *  define-agent.ts's AmbientEventType. */
export const AmbientEventEnum = z.enum([
  "ecourts.synced",
  "document.uploaded",
  "task.completed",
]);

export const AgentConfigSchema = z.object({
  /** Stable, unique, kebab-case — matches the file name. */
  name: z.string().min(1),
  description: z.string().min(1),
  trigger: AgentTriggerEnum,
  /** ambient agents: which events they subscribe to. */
  on: z.array(AmbientEventEnum).optional(),
  /** sidebar agents: app route prefixes they serve (e.g. "/matters"). */
  routes: z.array(z.string()).optional(),
  /** Key into the input-schema registry (lib/agents/inputs.ts). */
  input: z.string().min(1),
  /** Execution backend: "openrouter" (default), later "lyzr" | "crewai" | ... */
  adapter: z.string().default("openrouter"),
  /** Host-agnostic model id passed to the adapter, e.g. "anthropic/claude-sonnet-5". */
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  /** System prompt — the agent's mandate + grounding / citation rules. */
  system: z.string().min(1),
  /** Typed-action names (lib/actions) this agent is allowed to propose. */
  actions: z.array(z.string()).default([]),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
