"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  ArrowUp,
  Check,
  X,
  PanelRightClose,
  PanelRightOpen,
  Loader2,
  Quote,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CNRChip } from "@/components/badges";
import { OwlMark } from "@/components/owl-mark";
import {
  getAssistData,
  askOwl,
  approveProposal,
  dismissProposal,
  type AssistScope,
  type AssistProposal,
  type OwlAnswer,
} from "@/app/(app)/assistant/actions";

function matterIdFromPath(path: string): string | null {
  const m = path.match(/\/matters\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

// The persistent right-hand assistant. Always present on wide screens (the
// product owner's decision); hidden below lg for now (a drawer is the next step).
// Context-aware: it reads the current matter from the route and grounds every
// answer in that file only — the scope chip makes the CNR-isolation boundary
// visible.
export function AssistantRail() {
  const pathname = usePathname();
  const matterId = matterIdFromPath(pathname);

  const [scope, setScope] = useState<AssistScope>({ matterId, title: null, cnr: null });
  const [proposals, setProposals] = useState<AssistProposal[]>([]);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<OwlAnswer | null>(null);
  const [thinking, startThinking] = useTransition();
  const [, startRefresh] = useTransition();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setAnswer(null);
    let active = true;
    const load = async () => {
      try {
        const d = await getAssistData(matterId);
        if (active) {
          setScope(d.scope);
          setProposals(d.proposals);
        }
      } catch {
        // Transient (e.g. dev-server restart) — ignore; the next tick retries.
      }
    };
    load();
    // Poll so proposals filed elsewhere (e.g. "Run Owl", ambient sync) appear here.
    // Skip while the tab is hidden to avoid needless background load.
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 12000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [matterId]);

  const refresh = () =>
    startRefresh(async () => {
      const d = await getAssistData(matterId);
      setScope(d.scope);
      setProposals(d.proposals);
    });

  const ask = (text?: string) => {
    const question = (text ?? q).trim();
    if (!question || thinking) return;
    startThinking(async () => {
      const a = await askOwl(matterId, question);
      setAnswer(a);
      setQ("");
    });
  };

  const MATTER_EXAMPLES = [
    "What's the next hearing?",
    "What has changed recently?",
    "Is there a limitation deadline?",
  ];
  const PORTFOLIO_EXAMPLES = [
    "What's on this week?",
    "Anything overdue?",
    "Which matters changed recently?",
  ];
  const examples = scope.matterId ? MATTER_EXAMPLES : PORTFOLIO_EXAMPLES;

  if (collapsed) {
    return (
      <aside className="hidden shrink-0 flex-col items-center gap-3 border-l border-border bg-card/40 px-2 py-4 lg:flex">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Open Owl"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
        >
          <PanelRightOpen className="size-4" />
        </button>
        <OwlMark className="size-5 text-muted-foreground" />
        {proposals.length > 0 && (
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {proposals.length}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside
      data-tour="owl"
      className="hidden w-[360px] shrink-0 flex-col border-l border-border bg-card/40 lg:flex"
    >
      {/* Header + scope chip */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <OwlMark className="size-4 shrink-0" />
          <span className="text-sm font-semibold">Owl</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse Owl"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
        >
          <PanelRightClose className="size-4" />
        </button>
      </div>

      <div className="border-b border-border px-3 py-2">
        {scope.matterId && scope.title ? (
          <div className="flex flex-col gap-1">
            <span className="truncate text-xs font-medium">{scope.title}</span>
            <div className="flex items-center gap-1.5">
              <CNRChip cnr={scope.cnr} />
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3" /> This file only
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium">All matters</span>
            <span className="text-[11px] text-muted-foreground">
              Your calendar &amp; tasks. Open a case file for its full record.
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {proposals.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              For your approval
            </h3>
            {proposals.map((p) => (
              <ProposalCard key={p.id} p={p} onDone={refresh} />
            ))}
          </section>
        )}

        {answer ? (
          <section className="space-y-2">
            <div
              className={
                "rounded-lg border px-3 py-2 text-sm " +
                (answer.abstained
                  ? "border-dashed border-border bg-muted/40 text-muted-foreground"
                  : "border-border bg-background")
              }
            >
              {answer.answer || "—"}
            </div>
            {answer.sources.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Sources</span>
                {answer.sources.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    <Quote className="mt-0.5 size-3 shrink-0 opacity-60" />
                    <span className="min-w-0">{s}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          !proposals.length && (
            <div className="pt-6">
              <div className="text-center text-xs text-muted-foreground">
                <OwlMark className="mx-auto mb-2 size-6 opacity-50" />
                {scope.matterId
                  ? "Ask anything about this file."
                  : "Ask about your week — or open a case file for its full record."}
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                <span className="px-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Try asking
                </span>
                {examples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => ask(ex)}
                    className="rounded-md border border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* Ask input */}
      <div className="border-t border-border p-2">
        <div className="relative">
          <Textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder={scope.matterId ? "Ask about this file…" : "Ask about your matters…"}
            rows={2}
            className="resize-none pr-10 text-sm"
          />
          <Button
            type="button"
            size="icon"
            onClick={() => ask()}
            disabled={thinking || !q.trim()}
            aria-label="Ask Owl"
            className="absolute bottom-2 right-2 size-7"
          >
            {thinking ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUp className="size-3.5" />}
          </Button>
        </div>
        <p className="mt-1 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
          <Sparkles className="size-3" /> Answers only from your records, with sources.
        </p>
      </div>
    </aside>
  );
}

function ProposalCard({ p, onDone }: { p: AssistProposal; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles className="size-3 text-primary" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Put up by {p.agent}
        </span>
      </div>
      <p className="text-xs">{p.summary}</p>
      {p.trace && p.trace !== p.summary && (
        <p className="mt-1 text-[11px] text-muted-foreground">{p.trace}</p>
      )}
      <div className="mt-2 flex gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 flex-1 text-xs"
          disabled={pending}
          onClick={() => start(async () => { await approveProposal(p.id); onDone(); })}
        >
          <Check className="size-3.5" /> Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          disabled={pending}
          onClick={() => start(async () => { await dismissProposal(p.id); onDone(); })}
        >
          <X className="size-3.5" /> Dismiss
        </Button>
      </div>
    </div>
  );
}
