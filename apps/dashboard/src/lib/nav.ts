import {
  CalendarRange,
  Contact,
  Instagram,
  LifeBuoy,
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
 * The three pages a member opens during a normal week. They keep a permanent
 * slot in the header.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/events", label: "Schedules", icon: ListChecks, managerOnly: false },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarRange,
    managerOnly: false,
  },
  { href: "/presence", label: "Presence", icon: Users, managerOnly: false },
];

/**
 * Visited now and then rather than daily, so they live behind "More" instead of
 * crowding the header — which is what made room for Contacts in the first place.
 */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/contacts", label: "Contacts", icon: Contact, managerOnly: false },
  {
    href: "/instagram",
    label: "Instagram",
    icon: Instagram,
    managerOnly: false,
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    managerOnly: false,
  },
  { href: "/help", label: "Help", icon: LifeBuoy, managerOnly: false },
];

export function visibleTo(items: NavItem[], isManager: boolean): NavItem[] {
  return items.filter((i) => !i.managerOnly || isManager);
}
