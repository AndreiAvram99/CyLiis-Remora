import Link from "next/link";
import { CalendarDays, BarChart3, Settings } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { Providers } from "@/components/providers";
import { SignOutButton } from "@/components/sign-out-button";

const navItems = [
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/analytics", label: "Outreach", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <Providers>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-6">
              <Link href="/events" className="text-lg font-semibold">
                Event Reminder
              </Link>
              <nav className="flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
                  >
                    <item.icon size={16} />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3 text-sm text-neutral-400">
              <span className="hidden sm:inline">{session.user?.name}</span>
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
    </Providers>
  );
}
