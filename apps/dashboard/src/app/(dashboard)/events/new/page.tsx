import { getGuild, getTextChannels } from "@/lib/guild";
import { getKindDefaults } from "@/lib/defaults";
import { requireManager } from "@/lib/session";
import { EventForm } from "../event-form";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireManager();
  const [guild, channels, kindDefaults] = await Promise.all([
    getGuild(),
    getTextChannels(),
    getKindDefaults(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
        New schedule
      </h1>
      <EventForm
        mode="create"
        channels={channels.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
        }))}
        kindDefaults={kindDefaults}
        defaultChannelId={guild.defaultChannelId}
      />
    </div>
  );
}
