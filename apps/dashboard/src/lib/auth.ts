import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { env } from "./env";
import { fetchGuildMember, resolveManagerRoleIds } from "./discord";

interface DiscordProfile {
  id: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
}

// Read directly (non-throwing) so importing this module never crashes the build.
export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
      // guilds.members.read lets us check server membership + roles at login.
      authorization: { params: { scope: "identify guilds.members.read" } },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    // Only allow users who are members of the configured server (admins bypass).
    async signIn({ account, profile }) {
      const id = (profile as DiscordProfile | undefined)?.id;
      if (id && env.adminDiscordIds().includes(id)) return true;
      const token = account?.access_token;
      if (!token) return false;
      const member = await fetchGuildMember(token);
      return Boolean(member);
    },
    async jwt({ token, account, profile }) {
      if (profile) {
        const p = profile as DiscordProfile;
        token.discordId = p.id;
        token.discordName = p.global_name || p.username || "member";
      }
      // Runs on initial sign-in (account present): resolve membership + role.
      if (account?.access_token) {
        const isAdmin = Boolean(
          token.discordId &&
            env.adminDiscordIds().includes(token.discordId as string),
        );
        const member = await fetchGuildMember(account.access_token);
        const roles = member?.roles ?? [];
        const managerRoleIds = await resolveManagerRoleIds();

        token.isMember = Boolean(member) || isAdmin;
        token.isManager =
          isAdmin || (Boolean(member) && roles.some((r) => managerRoleIds.includes(r)));
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.discordId = token.discordId as string | undefined;
        session.user.name =
          (token.discordName as string | undefined) ?? session.user.name;
        session.user.isMember = Boolean(token.isMember);
        session.user.isManager = Boolean(token.isManager);
      }
      return session;
    },
  },
};
