import { Client, Events, GatewayIntentBits } from "discord.js";
import { env } from "./env.js";
import { syncChannels } from "./channels.js";
import { handleRsvpButton, handleMotivationModal } from "./rsvp.js";
import { reconcileScheduledEvents } from "./scheduledEvents.js";

export function createClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildScheduledEvents,
    ],
  });

  client.once(Events.ClientReady, async (c) => {
    console.log(`[bot] logged in as ${c.user.tag}`);
    try {
      await syncChannels(client, env.guildId());
      await reconcileScheduledEvents(client, env.guildId());
    } catch (err) {
      console.error("[bot] initial sync failed:", err);
    }
  });

  const resync = () =>
    syncChannels(client, env.guildId()).catch((err) =>
      console.error("[bot] channel resync failed:", err),
    );
  client.on(Events.ChannelCreate, resync);
  client.on(Events.ChannelUpdate, resync);
  client.on(Events.ChannelDelete, resync);

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
      await handleRsvpButton(interaction).catch((err) =>
        console.error("[bot] button handler error:", err),
      );
    } else if (interaction.isModalSubmit()) {
      await handleMotivationModal(interaction).catch((err) =>
        console.error("[bot] modal handler error:", err),
      );
    }
  });

  client.on(Events.Error, (err) => console.error("[bot] client error:", err));

  return client;
}
