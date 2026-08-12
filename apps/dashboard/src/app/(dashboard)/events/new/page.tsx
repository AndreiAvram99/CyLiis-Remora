import { printDefaultsOf } from "@repo/shared";
import { getGuild, getTextChannels } from "@/lib/guild";
import { postableChannels } from "@/lib/channel-access";
import { getKindDefaults } from "@/lib/defaults";
import { getAttendeeCandidates, getMentionOptions } from "@/lib/members";
import { requireManager } from "@/lib/session";
import { EventForm } from "../event-form";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireManager();
  const [guild, allChannels, kindDefaults, attendees, mentions] =
    await Promise.all([
      getGuild(),
      getTextChannels(),
      getKindDefaults(),
      getAttendeeCandidates(),
      getMentionOptions(),
    ]);

  const channels = await postableChannels(allChannels);
  // The guild default can be a channel this user isn't allowed to post in.
  const defaultChannelId = channels.some((c) => c.id === guild.defaultChannelId)
    ? guild.defaultChannelId
    : (channels[0]?.id ?? null);

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
        defaultChannelId={defaultChannelId}
        attendees={attendees}
        mentionRoles={mentions.roles}
        mentionMembers={mentions.members}
        printDefaults={printDefaultsOf(guild)}
      />
    </div>
  );
}
