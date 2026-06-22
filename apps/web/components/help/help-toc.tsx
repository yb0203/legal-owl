"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { HelpGroup } from "@/lib/help/content";

export interface TocItem {
  id: string;
  title: string;
  group: HelpGroup;
}

// Sticky in-page table of contents with active-section highlight (scroll-spy).
export function HelpToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = React.useState(items[0]?.id);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const it of items) {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  // Group items in source order while preserving first-seen group order.
  const groups: { group: HelpGroup; items: TocItem[] }[] = [];
  for (const it of items) {
    let g = groups.find((x) => x.group === it.group);
    if (!g) {
      g = { group: it.group, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }

  return (
    <nav className="space-y-4 text-sm">
      {groups.map((g) => (
        <div key={g.group}>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {g.group}
          </div>
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  className={cn(
                    "block rounded-md px-2 py-1 transition-colors hover:bg-accent/40",
                    active === it.id ? "bg-accent/40 text-foreground" : "text-muted-foreground",
                  )}
                >
                  {it.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
