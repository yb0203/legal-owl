// The `defineAgent` primitive — schema-locked specialists.
//
// Mirrors `defineAction` (lib/actions/define-action.ts, owned by another
// agent) one level up the stack: `invoke()` double-parses (input in, output
// out) so an LLM-backed `run` body added later can never leak an off-schema
// shape past this boundary. Agents never mutate the database directly — the only
// mutation channel is the Proposal envelope (see ./proposal.ts). A `run`
// body returns zero or more `Proposal`s for a human to approve; nothing in
// this file calls `insert`/`update`/`delete`.
//
// Registration (lib/agents/registry.ts) and event/route dispatch
// (lib/agents/orchestrator.ts) are owned by another agent and are
// deliberately not imported here, so this file has no dependency on
// modules that don't exist yet.

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Proposal } from "@/lib/agents/proposal";

/** How an agent gets invoked. */
export type AgentTrigger = "ambient" | "on_demand" | "sidebar";

/**
 * Ambient event names an agent can subscribe to via `on` (trigger ===
 * "ambient"). Kept as a local literal union — structurally identical to (and
 * therefore interchangeable with) the `AmbientEvent["type"]` union
 * lib/agents/orchestrator.ts actually defines and dispatches from — so this
 * file stays dependency-free of orchestrator.ts/registry.ts, which this task
 * does not touch. Keep in sync if the orchestrator's event union grows.
 */
export type AmbientEventType =
  | "ecourts.synced"
  | "document.uploaded"
  | "task.completed";

export interface AgentContext {
  /** Request-scoped authed client — READS ONLY. Agents never insert/update/
   *  delete; the only mutation channel is the Proposal envelope. */
  supabase: SupabaseClient;
  /** The authenticated lawyer (already resolved — agents never re-fetch it). */
  user: User;
  signal?: AbortSignal;
}

/**
 * Every agent run returns a validated answer payload plus zero or more
 * proposed mutations. `proposals` is the ONLY channel through which an
 * agent's work can ever reach the database — the orchestrator (
 * lib/agents/orchestrator.ts#emitProposal) gates and parks each one as a
 * Triage-state `tasks` row; only an explicit lawyer accept executes the
 * underlying action.
 */
export interface AgentResult<Out> {
  output: Out;
  proposals: Proposal[];
}

export interface AgentDef<In extends z.ZodType, Out extends z.ZodType> {
  /** Stable, unique, kebab-case: "intake-registrar", "limitation-clerk". */
  name: string;
  description: string;
  input: In;
  /** Convention: any NL assertion inside must carry citations (the
   *  record-ref | span-ref `Citation` shape from @/lib/schemas) so the
   *  orchestrator's render gate applies before anything derived from
   *  `output` is shown to a lawyer. */
  output: Out;
  trigger: AgentTrigger;
  /** sidebar agents: which app routes they serve (path prefixes, e.g. "/matters"). */
  routes?: string[];
  /** ambient agents: which events they subscribe to. */
  on?: AmbientEventType[];
  run: (
    input: z.output<In>,
    ctx: AgentContext,
  ) => Promise<AgentResult<z.output<Out>>>;
}

export interface Agent<
  In extends z.ZodType = z.ZodType,
  Out extends z.ZodType = z.ZodType,
> extends Readonly<Omit<AgentDef<In, Out>, "run">> {
  /**
   * The single entry point: parses `rawInput` against `input`, runs, then
   * parses the result's `output` against `output` before it ever leaves
   * this boundary. `proposals` pass through untouched (each proposal is
   * already args-validated at construction time — see createProposal in
   * ./proposal.ts).
   */
  invoke(
    rawInput: unknown,
    ctx: AgentContext,
  ): Promise<AgentResult<z.output<Out>>>;
}

export type AnyAgent = Agent<z.ZodType, z.ZodType>;

export function defineAgent<In extends z.ZodType, Out extends z.ZodType>(
  def: AgentDef<In, Out>,
): Agent<In, Out> {
  const { run, ...rest } = def;

  return {
    ...rest,
    async invoke(rawInput, ctx) {
      const input = def.input.parse(rawInput);
      const result = await run(input, ctx);
      const output = def.output.parse(result.output);
      return { output, proposals: result.proposals };
    },
  };
}
