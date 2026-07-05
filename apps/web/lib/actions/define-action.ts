// The typed-action primitive: one mutation, three transports (Server Action,
// HTTP, agent-proposal). Every mutation in the app is defined once via
// `defineAction` and funnels through a single validated `execute` entry point
// — no transport can bypass the input schema.
//
// No "use server" here: this module exports types/functions, not exclusively
// async functions, so it cannot itself be a Server Actions module. Server
// Action exposure happens via thin "use server" wrapper files that call
// `buildActionContext` + a typed action's `execute` (see
// app/(app)/tasks/actions.ts for the pattern).

import type { SupabaseClient, AuthUser as User } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Which transport invoked the action — for audit trails and revalidation decisions. */
export type ActionSource = "server-action" | "http" | "agent-proposal";

export interface ActionContext {
  /** Request-scoped authed client (from lib/supabase/server createClient) — RLS applies to every query. */
  supabase: SupabaseClient;
  /** The authenticated lawyer (supabase.auth.getUser()); actions never re-fetch it. */
  user: User;
  /** Which transport invoked the action — for audit trails and revalidation decisions. */
  source: ActionSource;
}

export type ActionErrorCode =
  | "validation" // input failed the zod schema
  | "unauthorized" // no user / RLS denial
  | "not_found" // referenced row invisible under RLS
  | "conflict" // uniqueness / idempotency collision
  | "internal";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: ActionErrorCode; message: string; issues?: z.core.$ZodIssue[] };
    };

export interface ActionDef<S extends z.ZodType, R> {
  /** Dot-namespaced, stable, unique: "task.create", "task.complete", "activity.addRemark", "matter.setStatus". */
  name: string;
  /** Becomes the agent-tool description verbatim. */
  description: string;
  input: S;
  run: (args: z.output<S>, ctx: ActionContext) => Promise<R>;
}

export interface TypedAction<S extends z.ZodType = z.ZodType, R = unknown> {
  name: string;
  description: string;
  input: S;
  /** THE single entry point: parses rawArgs with `input`, then runs. All transports funnel here. */
  execute(rawArgs: unknown, ctx: ActionContext): Promise<ActionResult<R>>;
  /** AI SDK-compatible tool descriptor (execution deferred — proposals only in v1). */
  asTool(): { name: string; description: string; inputSchema: S };
  /** POST handler: JSON body → execute; ctx built from cookies; 200/4xx mapped from ActionErrorCode. */
  asHttpHandler(): (req: Request) => Promise<Response>;
}

export type AnyAction = TypedAction<z.ZodType, unknown>;

function statusForErrorCode(code: ActionErrorCode): number {
  switch (code) {
    case "validation":
      return 400;
    case "unauthorized":
      return 401;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "internal":
      return 500;
  }
}

/**
 * Define one mutation. Args type is inferred from `input` (`z.output<S>`),
 * result type from `run`'s return (`R`) — one definition, zero duplicated
 * types. `execute` is the only place validation happens so no transport can
 * bypass the schema.
 */
export function defineAction<S extends z.ZodType, R>(def: ActionDef<S, R>): TypedAction<S, R> {
  const { name, description, input, run } = def;

  async function execute(rawArgs: unknown, ctx: ActionContext): Promise<ActionResult<R>> {
    const parsed = input.safeParse(rawArgs);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "validation",
          message: `Invalid input for action "${name}".`,
          issues: parsed.error.issues,
        },
      };
    }

    try {
      const data = await run(parsed.data, ctx);
      return { ok: true, data };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: "internal",
          message: err instanceof Error ? err.message : `Action "${name}" failed unexpectedly.`,
        },
      };
    }
  }

  return {
    name,
    description,
    input,
    execute,
    asTool() {
      return { name, description, inputSchema: input };
    },
    asHttpHandler() {
      return async (req: Request): Promise<Response> => {
        let rawArgs: unknown;
        try {
          rawArgs = await req.json();
        } catch {
          const result: ActionResult<R> = {
            ok: false,
            error: { code: "validation", message: "Request body must be valid JSON." },
          };
          return Response.json(result, { status: statusForErrorCode(result.error.code) });
        }

        const ctx = await buildActionContext("http");
        if (!ctx) {
          const result: ActionResult<R> = {
            ok: false,
            error: { code: "unauthorized", message: "Not authenticated." },
          };
          return Response.json(result, { status: statusForErrorCode(result.error.code) });
        }

        const result = await execute(rawArgs, ctx);
        return Response.json(result, {
          status: result.ok ? 200 : statusForErrorCode(result.error.code),
        });
      };
    },
  };
}

/**
 * Build an ActionContext for a given transport: an authed Supabase client
 * (RLS-scoped) + the current user. Returns null when unauthenticated so
 * callers can early-return without throwing (mirrors today's server-action
 * `if (!user) return;` convention).
 */
export async function buildActionContext(source: ActionSource): Promise<ActionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user, source };
}

/**
 * The one FormData→plain-object convention for wrapping typed actions in
 * Server Action FormData handlers: strings pass through, "" becomes
 * undefined (so `.optional()` schemas work), and zod coercion
 * (`z.coerce.date()` etc.) handles the rest.
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") {
      obj[key] = value;
      continue;
    }
    obj[key] = value === "" ? undefined : value;
  }
  return obj;
}

// ── Module registry ──────────────────────────────────────────────────────────
// Runtime lookup for dynamic callers (proposal acceptance, HTTP routing).
// Direct references to a defineAction() result stay fully typed; register/get
// trade that away for a name-keyed lookup, so prefer the direct reference
// where the call site already has it in scope.

const registry = new Map<string, AnyAction>();

/** Register a typed action under its own `name`. Re-registering the same name overwrites (dev/HMR-safe). */
export function register(action: AnyAction): void {
  registry.set(action.name, action);
}

/** Runtime lookup by name. Throws on unknown name. */
export function get(name: string): AnyAction {
  const action = registry.get(name);
  if (!action) {
    throw new Error(`Unknown action: "${name}".`);
  }
  return action;
}
