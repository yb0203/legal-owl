// Host-agnostic model client — every LLM call goes through OpenRouter, so the
// *provider* is a per-call config string ("anthropic/claude-sonnet-5",
// "openai/gpt-4o", "google/gemini-2.5-pro", ...) and nothing here is bound to a
// single vendor. Dependency-free: a plain fetch against OpenRouter's OpenAI-
// compatible endpoint. Reads OPENROUTER_API_KEY (falls back to the OPENROUTER
// name some envs use). Server-only — never import from a client component.

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CompleteOptions {
  /** OpenRouter model id, e.g. "anthropic/claude-sonnet-5". Host-agnostic. */
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the model for a JSON object body (response_format json_object). */
  json?: boolean;
  signal?: AbortSignal;
}

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY ?? process.env.OPENROUTER;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not set (add it to apps/web/.env.local and the Vercel/Supabase env)",
    );
  }
  return key;
}

/** One chat completion. Returns the assistant message content string. */
export async function complete(opts: CompleteOptions): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal: opts.signal,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      // OpenRouter attribution headers (optional but recommended).
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://legal-owl.vercel.app",
      "X-Title": "Legal Owl",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      response_format: opts.json ? { type: "json_object" } : undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}
