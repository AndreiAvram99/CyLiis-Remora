import {
  CalendarRange,
  Contact,
  Instagram,
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
 * The pages that belong to the team's work, in the order they're reached for.
 * What belongs to a person — their profile, the server's settings, and this
 * page's own help — hangs off the avatar instead, which keeps the bar short
 * enough to read without folding anything away behind a second tap.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/events", label: "Schedules", icon: ListChecks, managerOnly: false },
  {
    href: "/instagram",
    label: "Instagram",
    icon: Instagram,
    managerOnly: false,
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarRange,
    managerOnly: false,
  },
  { href: "/presence", label: "Presence", icon: Users, managerOnly: false },
  { href: "/contacts", label: "Contacts", icon: Contact, managerOnly: false },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    managerOnly: false,
  },
];

export function visibleTo(items: NavItem[], isManager: boolean): NavItem[] {
  return items.filter((i) => !i.managerOnly || isManager);
}
