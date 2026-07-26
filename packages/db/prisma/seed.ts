import { EventKind, prisma } from "../src/index.js";

const GUILD_ID = process.env.DISCORD_GUILD_ID ?? "000000000000000000";
const TIMEZONE = process.env.DEFAULT_TIMEZONE ?? "Europe/Bucharest";

const DEFAULTS: Array<{ kind: EventKind; offsetMinutes: number; label: string }> = [
  { kind: EventKind.MEETING, offsetMinutes: 60, label: "1 hour before" },
  { kind: EventKind.MEETING, offsetMinutes: 15, label: "15 minutes before" },
  { kind: EventKind.EVENT, offsetMinutes: 3 * 24 * 60, label: "3 days before" },
  { kind: EventKind.EVENT, offsetMinutes: 24 * 60, label: "1 day before" },
  { kind: EventKind.CUSTOM, offsetMinutes: 60, label: "1 hour before" },
];

async function main() {
  const guild = await prisma.guild.upsert({
    where: { id: GUILD_ID },
    create: { id: GUILD_ID, name: "My Server", timezone: TIMEZONE },
    update: {},
  });
  console.log(`Seeded guild ${guild.id} (${guild.name})`);

  for (const d of DEFAULTS) {
    await prisma.reminderDefault.upsert({
      where: {
        guildId_kind_offsetMinutes: {
          guildId: GUILD_ID,
          kind: d.kind,
          offsetMinutes: d.offsetMinutes,
        },
      },
      create: { guildId: GUILD_ID, ...d },
      update: { label: d.label },
    });
  }
  console.log(`Seeded ${DEFAULTS.length} default reminders`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
