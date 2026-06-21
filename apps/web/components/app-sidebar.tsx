"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Inbox, Scale, ListTodo, Settings, LogOut } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { logout } from "@/app/login/actions";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";

const NAV = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/triage", label: "Triage", icon: Inbox },
  { href: "/matters", label: "Matters", icon: Scale },
  { href: "/actions", label: "Actions", icon: ListTodo },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar({
  email,
  triageCount = 0,
}: {
  email?: string | null;
  triageCount?: number;
}) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-4">
        <Wordmark />
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarMenu>
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    isActive={active}
                    tooltip={label}
                    render={<Link href={href} />}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                  {href === "/triage" && triageCount > 0 && (
                    <SidebarMenuBadge>{triageCount}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center justify-between gap-2 px-2 text-xs text-muted-foreground">
          <span className="truncate">{email}</span>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded p-1 transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
