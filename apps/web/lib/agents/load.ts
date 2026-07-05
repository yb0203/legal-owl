// YAML loader — reads every agent definition in lib/agents/defs/, validates it
// against AgentConfigSchema, resolves its input schema + execution adapter, and
// builds a real Agent (defineAgent) whose run() delegates to the adapter. Called
// lazily + memoized from registry.ts, so nothing touches the filesystem until an
// agent is actually looked up. Server-only.
//
// Deploy note: the .yaml files must be traced into the serverless bundle — see
// `outputFileTracingIncludes` in next.config.ts.

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { defineAgent, type AnyAgent } from "@/lib/agents/define-agent";
import { ProposalSchema } from "@/lib/agents/proposal";
import { AgentConfigSchema, type AgentConfig } from "@/lib/agents/config";
import { getInputSchema } from "@/lib/agents/inputs";
import { getAdapter } from "@/lib/agents/adapters";

const DEFS_DIR = path.join(process.cwd(), "lib", "agents", "defs");

function buildAgent(config: AgentConfig): AnyAgent {
  const input = getInputSchema(config.input);
  const adapter = getAdapter(config.adapter);
  return defineAgent({
    name: config.name,
    description: config.description,
    input,
    output: ProposalSchema,
    trigger: config.trigger,
    on: config.on,
    routes: config.routes,
    run: (parsedInput, ctx) => adapter.run(config, parsedInput, ctx),
  });
}

/** Read + validate + build every agent in lib/agents/defs/. Throws on a bad or
 *  duplicate config — a malformed agent should never load silently. */
export function loadAgents(): AnyAgent[] {
  const files = fs
    .readdirSync(DEFS_DIR)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  const seen = new Set<string>();
  return files.map((file) => {
    const raw = parseYaml(fs.readFileSync(path.join(DEFS_DIR, file), "utf8"));
    const config = AgentConfigSchema.parse(raw);
    if (seen.has(config.name)) {
      throw new Error(`Duplicate agent name "${config.name}" (in ${file})`);
    }
    seen.add(config.name);
    return buildAgent(config);
  });
}
