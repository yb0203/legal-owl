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
import { titleForPath } from "@/lib/nav";

// Breadcrumb context for sub-pages only. Top-level pages render their own H1 via
// PageHeader, so the header stays clean (no duplicated title).
function crumbFor(pathname: string): { parent: string; parentHref: string } | null {
  const [first, second] = pathname.split("/").filter(Boolean);
  if (first === "matters" && second) return { parent: "Matters", parentHref: "/matters" };
  if (first === "clients" && second) return { parent: "Clients", parentHref: "/clients" };
  return null;
}

export function AppHeader({
  matters = [],
}: {
  matters?: { id: string; title: string; key: string }[];
}) {
  const pathname = usePathname();
  const crumb = crumbFor(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger />
      {crumb && (
        <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <Link href={crumb.parentHref} className="hover:text-foreground">
            {crumb.parent}
          </Link>
          <span aria-hidden>/</span>
          <span className="truncate text-foreground">{titleForPath(pathname)}</span>
        </nav>
      )}

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
