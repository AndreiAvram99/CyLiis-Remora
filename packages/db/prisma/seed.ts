import { EventKind, prisma } from "../src/index.js";

const GUILD_ID = process.env.DISCORD_GUILD_ID ?? "000000000000000000";
const TIMEZONE = process.env.DEFAULT_TIMEZONE ?? "Europe/Bucharest";

const DEFAULTS: Array<{
  kind: EventKind;
  offsetMinutes: number;
  label: string;
}> = [
  { kind: EventKind.MEETING, offsetMinutes: 60, label: "1 hour before" },
  { kind: EventKind.MEETING, offsetMinutes: 15, label: "15 minutes before" },
  { kind: EventKind.EVENT, offsetMinutes: 3 * 24 * 60, label: "3 days before" },
  { kind: EventKind.EVENT, offsetMinutes: 24 * 60, label: "1 day before" },
  { kind: EventKind.CUSTOM, offsetMinutes: 60, label: "1 hour before" },
];

/**
 * The sponsor behind the team. Written here rather than typed in by hand so a
 * fresh database still knows who backs us — but only created when absent, so
 * anything edited in the dashboard afterwards is left alone.
 */
const MAIN_SPONSOR = {
  kind: "SPONSOR",
  name: "Heaven Solutions",
  featured: true,
  email: "office.ro@heavensolutions.com",
  website: "https://www.heavensolutions.com/",
  notes: [
    "Aligning IT and business — software for regulated industries: medical devices and healthcare, transportation and logistics, oil and gas.",
    "Around 100 people across Iași, Gzira and Kirkland, in business for over 20 years. They back robotics teams and student scholarships.",
    "Iași office: Str. Sf. Petru Movilă 42, 700014.",
  ].join("\n\n"),
};

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

  const existing = await prisma.contact.findFirst({
    where: { guildId: GUILD_ID, name: MAIN_SPONSOR.name },
    select: { id: true },
  });
  if (existing) {
    console.log(`${MAIN_SPONSOR.name} already saved, left as it is`);
  } else {
    await prisma.contact.create({
      data: { guildId: GUILD_ID, ...MAIN_SPONSOR },
    });
    console.log(`Seeded ${MAIN_SPONSOR.name} as the main sponsor`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
