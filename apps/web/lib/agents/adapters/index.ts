// Adapter registry — the one place execution backends register. "openrouter" is
// built in; a Lyzr / CrewAI / n8n adapter is a new file implementing AgentAdapter
// (./types) + its own env key, then one registerAdapter() call here. Agents
// (YAML) select one by name via `adapter:`.

import type { AgentAdapter } from "@/lib/agents/adapters/types";
import { openrouterAdapter } from "@/lib/agents/adapters/openrouter";

const adapters = new Map<string, AgentAdapter>();

export function registerAdapter(adapter: AgentAdapter): void {
  adapters.set(adapter.name, adapter);
}

export function getAdapter(name: string): AgentAdapter {
  const adapter = adapters.get(name);
  if (!adapter) {
    throw new Error(
      `Unknown agent adapter: "${name}" — register it in lib/agents/adapters/index.ts`,
    );
  }
  return adapter;
}

// Built-in adapters. To add Lyzr/CrewAI: implement AgentAdapter in a new file,
// import it, and add one registerAdapter(...) line below.
registerAdapter(openrouterAdapter);

export type { AgentAdapter } from "@/lib/agents/adapters/types";
