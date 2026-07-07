"use client";

import { useState, useTransition } from "react";
import { Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMatterByCnr } from "./actions";
import { useRouter } from "next/navigation";

type PreviewState =
  | { stage: "idle" }
  | { stage: "loading" }
  | { stage: "error"; message: string }
  | { stage: "adding" }
  | { stage: "done" };

export function AddMatterByCnr() {
  const [cnr, setCnr] = useState("");
  const [state, setState] = useState<PreviewState>({ stage: "idle" });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isLoading = state.stage === "loading" || state.stage === "adding" || isPending;

  function handleAdd() {
    if (!cnr.trim()) return;
    setState({ stage: "adding" });
    startTransition(async () => {
      const result = await addMatterByCnr(cnr.trim().toUpperCase());
      if (result.ok) {
        setState({ stage: "done" });
        router.push(`/matters/${result.matterId}`);
      } else {
        setState({ stage: "error", message: result.error });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="cnr" className="text-base">
          Case Number Record (CNR)
        </Label>
        <p className="text-xs text-muted-foreground">
          The 16-character identifier printed on every eCourts case.
          Dashes are stripped automatically, so{" "}
          <span className="font-mono">UPHC02-023139-2025</span> and{" "}
          <span className="font-mono">UPHC020231392025</span> both work.
        </p>
        <div className="flex gap-2">
          <Input
            id="cnr"
            value={cnr}
            onChange={(e) => {
              setCnr(e.target.value);
              if (state.stage === "error") setState({ stage: "idle" });
            }}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && handleAdd()}
            placeholder="e.g. DLHC010001232024"
            className="font-mono text-base tracking-wider"
            disabled={isLoading || state.stage === "done"}
            autoFocus
            maxLength={20}
          />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={isLoading || !cnr.trim() || state.stage === "done"}
            className="shrink-0 gap-2"
          >
            {state.stage === "adding" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Fetching…
              </>
            ) : (
              <>
                <Search className="size-4" />
                Add matter
              </>
            )}
          </Button>
        </div>
      </div>

      {state.stage === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </div>
      )}

      {state.stage === "done" && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
          <CheckCircle2 className="size-4 shrink-0" />
          Matter added — loading case file…
        </div>
      )}

      {state.stage === "idle" && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">What happens when you add a matter:</p>
          <ul className="mt-2 space-y-1 list-none">
            <li>→ Legal Owl fetches the case from eCourts India</li>
            <li>→ Parties, court, status, next hearing, orders and hearing history are auto-populated</li>
            <li>→ Court Scout proposes follow-up tasks based on the latest activity</li>
            <li>→ You can update any detail from the matter's case file</li>
          </ul>
        </div>
      )}
    </div>
  );
}
