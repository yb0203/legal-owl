"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Search, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { Callout } from "@/components/layout";
import { CNRChip } from "@/components/badges";
import { createMatter, lookupCnr, type CnrLookupResult } from "@/app/(app)/matters/new/actions";

// The MVP "New matter" experience: the lawyer provides the CNR (the 16-char
// case number from eCourts); Legal Owl fetches and shows the case for
// confirmation before creating anything. A lawyer who doesn't have the CNR
// yet falls back to the manual form — finding a case without one (by court +
// case type + number + year, or by party name) is a known gap, tracked in
// docs/specs/court-monitoring.md, not part of this experience yet.

type Step =
  | { kind: "search" }
  | { kind: "confirm"; result: Extract<CnrLookupResult, { ok: true }> }
  | { kind: "not_found" };

export function CnrLookup({ clients }: { clients: { id: string; display_name: string }[] }) {
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [cnr, setCnr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startPending] = useTransition();

  const runLookup = () => {
    if (!cnr.trim() || pending) return;
    setError(null);
    startPending(async () => {
      const res = await lookupCnr(cnr.trim());
      if (!res.ok) {
        if (res.reason === "not_found") setStep({ kind: "not_found" });
        else setError("Couldn't reach eCourts right now — try again, or enter details manually.");
        return;
      }
      setStep({ kind: "confirm", result: res });
    });
  };

  if (step.kind === "confirm") {
    const c = step.result;
    const suggestedTitle =
      c.data.petitioners[0] && c.data.respondents[0]
        ? `${c.data.petitioners[0]} vs ${c.data.respondents[0]}`
        : c.cnr;
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setStep({ kind: "search" })}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Back
        </button>
        <Callout tone="lemon" className="space-y-1.5 p-3">
          <div className="flex items-center gap-2">
            <CNRChip cnr={c.cnr} />
            {c.data.court_status && (
              <span className="text-xs text-muted-foreground">{c.data.court_status}</span>
            )}
          </div>
          <p className="text-sm">
            {c.data.petitioners.join(", ") || "—"} <span className="text-muted-foreground">v.</span>{" "}
            {c.data.respondents.join(", ") || "—"}
          </p>
          {c.data.case_type && <p className="text-xs text-muted-foreground">{c.data.case_type}</p>}
        </Callout>

        <form action={createMatter} className="space-y-4">
          <input type="hidden" name="cnr" value={c.cnr} />
          <input type="hidden" name="forum_type" value={c.data.forum_type ?? "district"} />
          <input type="hidden" name="case_type" value={c.data.case_type ?? ""} />
          <input type="hidden" name="petitioners" value={c.data.petitioners.join("\n")} />
          <input type="hidden" name="respondents" value={c.data.respondents.join("\n")} />
          <input type="hidden" name="prefetched_case" value={JSON.stringify(c.data)} />

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required defaultValue={suggestedTitle} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client_id">Client</Label>
            <NativeSelect id="client_id" name="client_id" defaultValue="">
              <option value="">No client</option>
              {clients.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.display_name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" className="w-full">
            Create matter
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {step.kind === "not_found" && (
        <Callout tone="urgent" className="p-3 text-sm">
          No case found for that CNR. Double-check it, or{" "}
          <Link href="/matters/new?manual=1" className="underline">
            enter this matter manually
          </Link>
          .
        </Callout>
      )}
      {error && (
        <Callout tone="urgent" className="p-3 text-sm">
          {error}
        </Callout>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cnr">CNR</Label>
        <Input
          id="cnr"
          value={cnr}
          onChange={(e) => setCnr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runLookup();
            }
          }}
          placeholder="e.g. DLHC010001232024"
          className="font-mono"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          The 16-character case number from the court&apos;s eCourts record.
        </p>
      </div>

      <Button type="button" className="w-full" disabled={!cnr.trim() || pending} onClick={runLookup}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        Find case
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Don&apos;t have the CNR?{" "}
        <Link href="/matters/new?manual=1" className="underline">
          Enter this matter manually
        </Link>
        .
      </p>
    </div>
  );
}
