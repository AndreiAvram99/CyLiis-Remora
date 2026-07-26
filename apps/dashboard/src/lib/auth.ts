import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { env } from "./env";

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
      authorization: { params: { scope: "identify" } },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      const id = (profile as DiscordProfile | undefined)?.id;
      const admins = env.adminDiscordIds();
      // If no allowlist is configured, deny by default for safety.
      return Boolean(id && admins.includes(id));
    },
    async jwt({ token, profile }) {
      if (profile) {
        const p = profile as DiscordProfile;
        token.discordId = p.id;
        token.discordName = p.global_name || p.username || "admin";
      }
      return token;
    },
    async session({ session, token }) {
      const discordId = token.discordId as string | undefined;
      if (session.user) {
        session.user.discordId = discordId;
        session.user.name =
          (token.discordName as string | undefined) ?? session.user.name;
        session.user.isAdmin = Boolean(
          discordId && env.adminDiscordIds().includes(discordId),
        );
      }
      return session;
    },
  },
};
