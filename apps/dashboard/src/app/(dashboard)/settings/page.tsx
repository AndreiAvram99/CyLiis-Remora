import { prisma } from "@repo/db";
import type { EventKindName } from "@repo/shared";
import { getGuild, getTextChannels } from "@/lib/guild";
import { env } from "@/lib/env";
import { isCalendarEnabled } from "@/lib/gcal";
import { requireManager } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireManager();
  const [guild, channels, defaults] = await Promise.all([
    getGuild(),
    getTextChannels(),
    prisma.reminderDefault.findMany({
      where: { guildId: env.guildId() },
      orderBy: { offsetMinutes: "desc" },
    }),
  ]);

  const grouped: Record<EventKindName, number[]> = {
    MEETING: [],
    EVENT: [],
    CUSTOM: [],
  };
  for (const d of defaults) grouped[d.kind as EventKindName].push(d.offsetMinutes);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-neutral-400">
          Google Calendar sync is{" "}
          <span
            className={
              isCalendarEnabled() ? "text-emerald-400" : "text-neutral-400"
            }
          >
            {isCalendarEnabled() ? "connected" : "not configured"}
          </span>
          .
        </p>
      </div>
      <SettingsForm
        timezone={guild.timezone}
        defaultChannelId={guild.defaultChannelId}
        channels={channels.map((c) => ({ id: c.id, name: c.name }))}
        defaults={grouped}
      />
    </div>
  );
}
