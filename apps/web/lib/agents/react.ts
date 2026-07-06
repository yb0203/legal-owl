import type { SupabaseClient, User } from "@supabase/supabase-js";
import { runAmbient } from "@/lib/agents/orchestrator";
import type { SyncEvent } from "@/lib/ecourts/sync";

// Fire the `ecourts.synced` ambient event so agents (Court Scout) turn court
// changes into cited, approve-before-act proposals in the Inbox. Best-effort —
// never throws into the sync path (runAmbient already isolates per-agent
// failures). Called ONLY from interactive syncs (Sync now / connect-by-CNR); the
// nightly cron stays deterministic so it never fans a fleet of LLM calls at scale.
export async function reactToSync(
  supabase: SupabaseClient,
  lawyerId: string,
  matterId: string,
  events: SyncEvent[],
): Promise<void> {
  if (!events.length) return;
  try {
    await runAmbient(
      {
        type: "ecourts.synced",
        matter_id: matterId,
        activity_ids: events.map((e) => e.id),
        changes: events.map((e) => ({
          event_type: e.event_type,
          previous_value: e.previous_value,
          new_value: e.new_value,
          occurred_at: e.occurred_at ?? undefined,
        })),
      },
      { supabase, user: { id: lawyerId } as unknown as User },
    );
  } catch (err) {
    console.error("[reactToSync] court-sync agent reaction failed:", err);
  }
}
