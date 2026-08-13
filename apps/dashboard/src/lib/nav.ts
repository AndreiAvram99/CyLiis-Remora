import {
  CalendarRange,
  Contact,
  ListChecks,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  managerOnly: boolean;
};

/**
 * Ordered the way a meeting actually moves: it's arranged, then it's somewhere
 * in the month, then people either turn up or don't, and that adds up over a
 * term. Contacts closes the row because it's a reference rather than something
 * that happens.
 *
 * What belongs to a person — their profile, the server's settings, the help
 * page — hangs off the avatar instead.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/events", label: "Schedules", icon: ListChecks, managerOnly: false },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarRange,
    managerOnly: false,
  },
  { href: "/presence", label: "Presence", icon: Users, managerOnly: false },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    managerOnly: false,
  },
  { href: "/contacts", label: "Contacts", icon: Contact, managerOnly: false },
];

export function visibleTo(items: NavItem[], isManager: boolean): NavItem[] {
  return items.filter((i) => !i.managerOnly || isManager);
}
