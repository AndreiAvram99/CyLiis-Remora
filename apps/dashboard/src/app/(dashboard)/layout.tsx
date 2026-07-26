import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Users, Settings } from "lucide-react";
import { requireMember } from "@/lib/session";
import { Providers } from "@/components/providers";
import { SignOutButton } from "@/components/sign-out-button";

const navItems = [
  { href: "/events", label: "Events", icon: CalendarDays, managerOnly: false },
  { href: "/presence", label: "Presence", icon: Users, managerOnly: false },
  { href: "/settings", label: "Settings", icon: Settings, managerOnly: true },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireMember();
  const isManager = Boolean(session.user?.isManager);
  const visibleNav = navItems.filter((i) => !i.managerOnly || isManager);

  return (
    <Providers>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-6">
              <Link href="/events" className="flex items-center gap-2 text-lg font-semibold">
                <Image
                  src="/logo.png"
                  alt="CyLiis Remora"
                  width={32}
                  height={32}
                  priority
                />
                CyLiis Remora
              </Link>
              <nav className="flex items-center gap-1">
                {visibleNav.map((item) => (
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
              <span className="hidden items-center gap-2 sm:flex">
                {session.user?.name}
                {!isManager ? (
                  <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                    View only
                  </span>
                ) : null}
              </span>
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
    </Providers>
  );
}
