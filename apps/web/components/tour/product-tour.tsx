"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { OwlMark } from "@/components/owl-mark";

// A minimal spotlight tour: dim the page, ring the current target, show a card.
// Starts when the lawyer arrives via "See it in action" (?tour=1). Three steps —
// deliberately small; it teaches the shape, it isn't a manual.

interface Step {
  selector?: string; // element to spotlight; omitted = centered welcome card
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "Welcome to Legal Owl",
    body: "A 20-second tour of how your practice lives here. You can skip anytime.",
  },
  {
    selector: '[data-tour="sidebar"]',
    title: "Your day, and your case files",
    body: "Today — Home, Inbox, Tasks, Calendar. Case files — Matters and Clients. Everything you do hangs off a Matter.",
  },
  {
    selector: '[data-tour="board"]',
    title: "Your board — most urgent first",
    body: "Hearings, overdue work, and the inbox are surfaced up top, so you always know what needs you today. A hearing or a deadline is just a task with a date.",
  },
  {
    selector: '[data-tour="owl"]',
    title: "Owl, your case assistant",
    body: "Always here on the right. Open a matter and ask anything — Owl answers only from that case file, with sources, and puts actions up for your approval.",
  },
];

const CARD_W = 320;
const CARD_H = 180;

export function ProductTour() {
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tour") === "1") {
      setActive(true);
      setI(0);
    }
  }, []);

  const measure = useCallback(() => {
    const sel = STEPS[i]?.selector;
    const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setRect(el.getBoundingClientRect());
  }, [i]);

  useEffect(() => {
    if (!active) return;
    measure();
    const t = setTimeout(measure, 350); // re-measure after scroll settles
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [active, measure]);

  const end = useCallback(() => {
    setActive(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("tour");
    window.history.replaceState({}, "", url.toString());
  }, []);

  if (!active) return null;

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const clampTop = (t: number) => Math.max(16, Math.min(t, vh - CARD_H - 16));

  let cardStyle: CSSProperties;
  if (!rect) {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: CARD_W };
  } else if (rect.right < vw / 2) {
    // Target on the left (e.g. the nav) — place the card to its right.
    cardStyle = { top: clampTop(rect.top), left: rect.right + 16, width: CARD_W };
  } else if (rect.left > vw / 2) {
    // Target on the right (e.g. the Owl rail) — place the card to its left.
    cardStyle = { top: clampTop(rect.top), left: Math.max(16, rect.left - CARD_W - 16), width: CARD_W };
  } else {
    // Target spanning the middle (e.g. the board) — below, or above if it won't fit.
    const below = rect.bottom + 14;
    const top = below + CARD_H < vh ? below : Math.max(16, rect.top - CARD_H - 14);
    cardStyle = { top, left: Math.max(16, Math.min(rect.left, vw - CARD_W - 16)), width: CARD_W };
  }

  return (
    <div className="fixed inset-0 z-[200]">
      {rect ? (
        <>
          {/* transparent click-catcher so the page is inert during the tour */}
          <div className="absolute inset-0" />
          <div
            className="pointer-events-none absolute rounded-xl ring-2 ring-primary"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}

      <div className="absolute rounded-xl border border-border bg-card p-4 shadow-2xl" style={cardStyle}>
        <div className="mb-1.5 flex items-center gap-1.5">
          <OwlMark className="size-4" />
          <span className="text-xs font-medium text-muted-foreground">
            {i + 1} of {STEPS.length}
          </span>
        </div>
        <h3 className="font-serif text-base font-semibold tracking-tight">{step.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={end}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex gap-1.5">
            {i > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setI(i - 1)}>
                Back
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => (last ? end() : setI(i + 1))}>
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
