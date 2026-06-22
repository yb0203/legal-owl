"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { logout } from "@/app/login/actions";
import { NAV_SECTIONS, FOOTER_ITEMS, isActivePath, type NavCountKey } from "@/lib/nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";

export function AppSidebar({
  email,
  inboxCount = 0,
  tasksDueToday = 0,
  hearingsToday = 0,
}: {
  email?: string | null;
  inboxCount?: number;
  tasksDueToday?: number;
  hearingsToday?: number;
}) {
  const pathname = usePathname();
  const initials = (email ?? "?").slice(0, 2).toUpperCase();
  const counts: Record<NavCountKey, number> = {
    inbox: inboxCount,
    tasksDueToday,
    hearingsToday,
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-4">
        <Wordmark />
      </SidebarHeader>

      <SidebarContent className="px-2">
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map(({ href, label, icon: Icon, count }) => {
                  const active = isActivePath(pathname, href);
                  const n = count ? counts[count] : 0;
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton isActive={active} tooltip={label} render={<Link href={href} />}>
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                      {n > 0 && <SidebarMenuBadge>{n}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          {FOOTER_ITEMS.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={isActivePath(pathname, item.href)}
                tooltip={item.label}
                render={<Link href={item.href} />}
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <form action={logout} id="signout-form" className="hidden" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
              />
            }
          >
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-sm">{email}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52">
            <DropdownMenuItem
              onClick={() =>
                (document.getElementById("signout-form") as HTMLFormElement | null)?.requestSubmit()
              }
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
