// Single source of truth for app navigation — consumed by the sidebar, the
// command palette, and the header breadcrumb so the three never drift.
// Grouped the way a lawyer works: "Today" (time-sensitive, act-now) is its own
// cluster, separate from the "Case files" reference surfaces.
import {
  CalendarDays,
  CircleHelp,
  Home,
  Inbox,
  ListTodo,
  Scale,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Which live count, if any, this nav item should surface as a badge. */
export type NavCountKey = "inbox" | "tasksDueToday" | "hearingsToday";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  count?: NavCountKey;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Today",
    items: [
      { href: "/home", label: "Home", icon: Home, description: "Your day at a glance" },
      { href: "/inbox", label: "Inbox", icon: Inbox, count: "inbox", description: "Case updates to triage" },
      { href: "/tasks", label: "Tasks", icon: ListTodo, count: "tasksDueToday", description: "To-dos across your matters" },
      { href: "/calendar", label: "Calendar", icon: CalendarDays, count: "hearingsToday", description: "Hearings & deadlines" },
    ],
  },
  {
    label: "Case files",
    items: [
      { href: "/matters", label: "Matters", icon: Scale, description: "All your case files" },
      { href: "/clients", label: "Clients", icon: Users, description: "People & organisations" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
  description: "Account, firm & preferences",
};

export const HELP_ITEM: NavItem = {
  href: "/help",
  label: "Help",
  icon: CircleHelp,
  description: "How to use Legal Owl",
};

/** Footer/reference items shown below the main sections. */
export const FOOTER_ITEMS: NavItem[] = [HELP_ITEM, SETTINGS_ITEM];

/** Flat list of every nav destination (sections + footer). */
export const ALL_NAV: NavItem[] = [
  ...NAV_SECTIONS.flatMap((s) => s.items),
  ...FOOTER_ITEMS,
];

/** Resolve a human title for a pathname (handles detail/new sub-routes). */
export function titleForPath(pathname: string): string {
  const [first, second] = pathname.split("/").filter(Boolean);
  if (first === "matters" && second === "new") return "New matter";
  if (first === "matters" && second) return "Matter";
  if (first === "clients" && second === "new") return "New client";
  if (first === "clients" && second) return "Client";
  return ALL_NAV.find((n) => n.href === `/${first}`)?.label ?? "Legal Owl";
}

/** Is a nav href the active route for the given pathname? */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
