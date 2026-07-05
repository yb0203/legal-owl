// The pluggable execution seam. An adapter turns an agent's CONFIG + input into
// a Proposal (approve-before-act). "openrouter" is the built-in; a Lyzr / CrewAI
// / n8n adapter is just another file implementing this interface + its own env
// key — no change to the agents (YAML) themselves.

import type { AgentContext, AgentResult } from "@/lib/agents/define-agent";
import type { Proposal } from "@/lib/agents/proposal";
import type { AgentConfig } from "@/lib/agents/config";

export interface AgentAdapter {
  /** Matches AgentConfig.adapter (e.g. "openrouter", "lyzr", "crewai"). */
  name: string;
  run(
    config: AgentConfig,
    input: unknown,
    ctx: AgentContext,
  ): Promise<AgentResult<Proposal>>;
}
