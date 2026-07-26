import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";

// Local preview only: set DEV_AUTOLOGIN=true (never in production) to browse the
// dashboard without configuring Discord OAuth. Set DEV_AUTOLOGIN=member to
// preview the view-only (non-manager) experience.
function devSession(): Session | null {
  const mode = process.env.DEV_AUTOLOGIN;
  if (
    (mode === "true" || mode === "member") &&
    process.env.NODE_ENV !== "production"
  ) {
    const isManager = mode === "true";
    return {
      user: {
        name: isManager ? "Dev Manager" : "Dev Member",
        discordId: "dev",
        isMember: true,
        isManager,
      },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }
  return null;
}

export async function getSession() {
  return devSession() ?? (await getServerSession(authOptions));
}

/** Guard for pages any server member may view. */
export async function requireMember() {
  const session = await getSession();
  if (!session?.user?.isMember) {
    redirect("/login");
  }
  return session;
}

/** Guard for management-only pages; view-only members are sent back to events. */
export async function requireManager() {
  const session = await requireMember();
  if (!session.user?.isManager) {
    redirect("/events");
  }
  return session;
}

/** Assertion for mutating server actions; throws if the user can't manage. */
export async function assertManager() {
  const session = await getSession();
  if (!session?.user?.isManager) {
    throw new Error("You do not have permission to perform this action.");
  }
  return session;
}
