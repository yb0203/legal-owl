"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  FilePlus2,
  Home,
  Inbox,
  ListTodo,
  Scale,
  Search,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const NAV = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Matters", href: "/matters", icon: Scale },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function CommandPalette({
  matters = [],
}: {
  matters?: { id: string; title: string; key: string }[];
}) {
  const [open, setOpen] = React.useState(false);
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

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
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
            {NAV.map((n) => (
              <CommandItem key={n.href} value={`go ${n.label}`} onSelect={() => go(n.href)}>
                <n.icon />
                {n.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {matters.length > 0 && (
            <CommandGroup heading="Matters">
              {matters.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`matter ${m.title} ${m.key}`}
                  onSelect={() => go(`/matters/${m.id}`)}
                >
                  <Scale />
                  <span className="truncate">{m.title}</span>
                  <span className="tnum ml-auto font-mono text-xs text-muted-foreground">
                    {m.key}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
