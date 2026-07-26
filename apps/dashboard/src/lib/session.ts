import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";

export async function getSession() {
  return getServerSession(authOptions);
}

/** Server-side guard for dashboard pages and mutating actions. */
export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.isAdmin) {
    redirect("/login");
  }
  return session;
}
