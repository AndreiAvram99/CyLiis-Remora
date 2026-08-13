import Link from "next/link";
import { requireMember } from "@/lib/session";
import { Providers } from "@/components/providers";
import { UserMenu } from "@/components/user-menu";
import { NavLink } from "@/components/nav-link";
import { MoreMenu } from "@/components/more-menu";
import { MobileNav } from "@/components/mobile-nav";
import { BrandMark } from "@/components/brand-mark";
import { currentAvatarUrl } from "@/lib/members";
import { PRIMARY_NAV, visibleTo } from "@/lib/nav";

// Settings hangs off the avatar menu rather than the top bar — it's rarely used
// and manager-only, so it doesn't earn a permanent slot. The occasional pages
// sit behind "More" for the same reason; the header keeps the weekly three.

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireMember();
  const isManager = Boolean(session.user?.isManager);
  const myAvatar = await currentAvatarUrl(
    session.user?.discordId,
    session.user?.image,
  );
  const navLinks = (
    <>
      {visibleTo(PRIMARY_NAV, isManager).map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label}>
          <item.icon size={16} />
        </NavLink>
      ))}
      <MoreMenu isManager={isManager} />
    </>
  );

  return (
    <Providers>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[rgb(var(--line))] bg-[rgb(var(--nav))]">
          <div className="mx-auto max-w-6xl px-5">
            <div className="flex items-center justify-between gap-3 py-4">
              <div className="flex min-w-0 items-center gap-3 sm:gap-8">
                {/* Phone-only hamburger that opens a left slide-in drawer. */}
                <MobileNav isManager={isManager} />
                <Link
                  href="/events"
                  className="flex shrink-0 items-center gap-2.5 text-lg font-semibold tracking-tight text-neutral-100"
                >
                  <BrandMark size={34} priority />
                  <span>CyLiis Remora</span>
                </Link>
                {/* Inline nav on tablet/desktop; drawer on phones. */}
                <nav className="hidden items-center gap-1 sm:flex">
                  {navLinks}
                </nav>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-neutral-400 sm:gap-2">
                {!isManager ? (
                  <span className="hidden rounded-full border border-neutral-800 px-2.5 py-0.5 text-xs text-neutral-500 sm:inline">
                    View only
                  </span>
                ) : null}
                <UserMenu
                  name={session.user?.name}
                  avatarUrl={myAvatar}
                  isManager={isManager}
                />
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 sm:py-10">{children}</main>
      </div>
    </Providers>
  );
}
