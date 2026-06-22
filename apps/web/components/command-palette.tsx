"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, FilePlus2, Scale, Search, UserPlus } from "lucide-react";
import { ALL_NAV } from "@/lib/nav";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface MatterLite {
  id: string;
  title: string;
  key: string;
}

const RECENTS_KEY = "lo:recent-matters";

function readRecents(): MatterLite[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as MatterLite[]) : [];
  } catch {
    return [];
  }
}

export function CommandPalette({ matters = [] }: { matters?: MatterLite[] }) {
  const [open, setOpen] = React.useState(false);
  const [recents, setRecents] = React.useState<MatterLite[]>([]);
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Refresh the recents list each time the palette opens.
  React.useEffect(() => {
    if (open) setRecents(readRecents());
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const goMatter = (m: MatterLite) => {
    try {
      const next = [m, ...readRecents().filter((r) => r.id !== m.id)].slice(0, 5);
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      /* ignore storage failures */
    }
    go(`/matters/${m.id}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border bg-input/30 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="tnum ml-1 hidden rounded bg-muted px-1.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search or jump to…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>

          {recents.length > 0 && (
            <CommandGroup heading="Recent">
              {recents.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`recent ${m.title} ${m.key}`}
                  onSelect={() => goMatter(m)}
                >
                  <Clock />
                  <span className="truncate">{m.title}</span>
                  <span className="tnum ml-auto font-mono text-xs text-muted-foreground">{m.key}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Create">
            <CommandItem value="new matter create" onSelect={() => go("/matters/new")}>
              <FilePlus2 />
              New matter
            </CommandItem>
            <CommandItem value="new client create" onSelect={() => go("/clients/new")}>
              <UserPlus />
              New client
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Go to">
            {ALL_NAV.map((n) => (
              <CommandItem key={n.href} value={`go ${n.label} ${n.description}`} onSelect={() => go(n.href)}>
                <n.icon />
                <span>{n.label}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">{n.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {matters.length > 0 && (
            <CommandGroup heading="Matters">
              {matters.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`matter ${m.title} ${m.key}`}
                  onSelect={() => goMatter(m)}
                >
                  <Scale />
                  <span className="truncate">{m.title}</span>
                  <span className="tnum ml-auto font-mono text-xs text-muted-foreground">{m.key}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>

        <div className="flex items-center justify-end gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <span>
            <kbd className="rounded bg-muted px-1 font-sans">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="rounded bg-muted px-1 font-sans">↵</kbd> open
          </span>
          <span>
            <kbd className="rounded bg-muted px-1 font-sans">esc</kbd> close
          </span>
        </div>
      </CommandDialog>
    </>
  );
}
