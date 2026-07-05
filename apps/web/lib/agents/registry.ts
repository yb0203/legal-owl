// The agent registry — sourced from the YAML definitions in lib/agents/defs/ via
// the loader (lib/agents/load.ts), lazily and memoized so nothing hits the
// filesystem until an agent is actually looked up. Agents are declared in YAML,
// not code (see lib/agents/config.ts); add one by dropping a new .yaml file in
// lib/agents/defs/ (and its input schema in lib/agents/inputs.ts).
//
// NOT "use server" — a plain module imported by orchestrator.ts and (eventually)
// server actions / route handlers that look up an agent by name.

import type { AgentTrigger, AnyAgent } from "@/lib/agents/define-agent";
import { loadAgents } from "@/lib/agents/load";

/** Agent names are open (defined in YAML), so this is a string alias; the loader
 *  enforces uniqueness at load time. */
export type AgentName = string;

let byName: Map<string, AnyAgent> | null = null;
function index(): Map<string, AnyAgent> {
  if (!byName) {
    byName = new Map(loadAgents().map((agent) => [agent.name, agent]));
  }
  return byName;
}

/** Runtime lookup for dynamic callers (orchestrator.ask, ambient dispatch). Throws on unknown name. */
export function getAgent(name: string): AnyAgent {
  const agent = index().get(name);
  if (!agent) {
    throw new Error(`Unknown agent: "${name}"`);
  }
  return agent;
}

/** All registered agents, in load (file-name) order. */
export function listAgents(): AnyAgent[] {
  return [...index().values()];
}

/** Registered agents filtered by trigger kind ("ambient" | "on_demand" | "sidebar"). */
export function listAgentsByTrigger(trigger: AgentTrigger): AnyAgent[] {
  return listAgents().filter((agent) => agent.trigger === trigger);
}
