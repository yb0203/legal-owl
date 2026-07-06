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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One chat completion, with retries. Free models (openrouter/free) frequently
 * return 429 (rate-limited upstream) or an empty body; retry those a few times
 * with backoff before giving up. Returns the assistant message content string.
 */
export async function complete(opts: CompleteOptions): Promise<string> {
  const key = apiKey();
  const body = JSON.stringify({
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
    response_format: opts.json ? { type: "json_object" } : undefined,
  });

  let lastError = "OpenRouter request failed";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: opts.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://legal-owl.vercel.app",
        "X-Title": "Legal Owl",
      },
      body,
    });

    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content ?? "";
      if (content.trim()) return content;
      lastError = "OpenRouter returned an empty response";
    } else {
      const text = await res.text().catch(() => "");
      lastError = `OpenRouter ${res.status} ${res.statusText}: ${text.slice(0, 300)}`;
      // Only rate-limits (429) and transient upstream/server errors are worth retrying.
      if (res.status !== 429 && res.status < 500) break;
    }
    if (attempt < 3) await sleep(1500 * (attempt + 1));
  }
  throw new Error(lastError);
}
