// The one agent registry — a typed map, `as const satisfies` so adding an
// agent is a one-line edit that flows types (AgentName) everywhere a
// route/ambient/ask call touches it. One level up the stack, the actions
// primitive (lib/actions/define-action.ts, owned by another agent) takes a
// runtime Map-based register()/get() instead — this file uses the compile-time
// `as const satisfies` form because the agent set is closed and known here.
//
// NOT "use server" — this is a plain module, imported by orchestrator.ts and
// (eventually) by server actions / route handlers that need to look up an
// agent by name.

import type { AgentTrigger, AnyAgent } from "@/lib/agents/define-agent";
import { limitationClerkAgent } from "@/lib/agents/agents/limitation-clerk";
import { intakeRegistrarAgent } from "@/lib/agents/agents/intake-registrar";

/**
 * Specialist agents register here, one line per agent. Adding a new one is
 * exactly this: implement it with `defineAgent` (lib/agents/define-agent.ts),
 * import it, and add a line below — `AgentName` and every route()/ask()/
 * runAmbient() call site pick it up automatically, with no other file to edit.
 */
export const agents = {
  "limitation-clerk": limitationClerkAgent,
  "intake-registrar": intakeRegistrarAgent,
} as const satisfies Record<string, AnyAgent>;

export type AgentName = keyof typeof agents;

/** Runtime lookup for dynamic callers (orchestrator.ask, ambient dispatch). Throws on unknown name. */
export function getAgent(name: string): AnyAgent {
  const agent = (agents as Record<string, AnyAgent>)[name];
  if (!agent) {
    throw new Error(`Unknown agent: "${name}"`);
  }
  return agent;
}

/** All registered agents, in registry (declaration) order. */
export function listAgents(): AnyAgent[] {
  return Object.values(agents) as AnyAgent[];
}

/** Registered agents filtered by trigger kind ("ambient" | "on_demand" | "sidebar"), in registry order. */
export function listAgentsByTrigger(trigger: AgentTrigger): AnyAgent[] {
  return listAgents().filter((agent) => agent.trigger === trigger);
}
