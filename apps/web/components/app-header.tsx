"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, FilePlus2, UserPlus } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from "@/components/command-palette";

const TITLES: Record<string, string> = {
  home: "Home",
  matters: "Matters",
  inbox: "Inbox",
  tasks: "Tasks",
  calendar: "Calendar",
  clients: "Clients",
  settings: "Settings",
};

function titleFor(pathname: string): string {
  const segs = pathname.split("/").filter(Boolean);
  const [first, second] = segs;
  if (first === "matters" && second === "new") return "New matter";
  if (first === "matters" && second) return "Matter";
  if (first === "clients" && second === "new") return "New client";
  if (first === "clients" && second) return "Client";
  return TITLES[first] ?? "Legal Owl";
}

export function AppHeader({
  matters = [],
}: {
  matters?: { id: string; title: string; key: string }[];
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger />
      <h1 className="font-serif text-base font-semibold tracking-tight">{titleFor(pathname)}</h1>

      <div className="ml-auto flex items-center gap-2">
        <CommandPalette matters={matters} />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" />}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">New</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href="/matters/new" />}>
              <FilePlus2 className="size-4" />
              New matter
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/clients/new" />}>
              <UserPlus className="size-4" />
              New client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
