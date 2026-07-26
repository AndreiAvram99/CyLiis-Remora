// Populates the local preview DB with realistic sample data so the UI looks
// alive. Safe to re-run (clears demo events/channels for the demo guild first).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const GUILD_ID = process.env.DISCORD_GUILD_ID ?? "123456789012345678";
const TZ = process.env.DEFAULT_TIMEZONE ?? "Europe/Bucharest";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = Date.now();

const channels = [
  { id: "c_events", name: "events" },
  { id: "c_festival", name: "festival" },
  { id: "c_hardware", name: "hardware" },
  { id: "c_printing", name: "printing" },
  { id: "c_branding", name: "branding" },
  { id: "c_sustenability", name: "sustenability" },
  { id: "c_general", name: "general" },
];

function reminders(startAt, offsetsMin, { markSent = false } = {}) {
  return offsetsMin.map((off) => {
    const dueAt = new Date(startAt.getTime() - off * MIN);
    const label =
      off % (24 * 60) === 0
        ? `${off / (24 * 60)} day${off / (24 * 60) === 1 ? "" : "s"} before`
        : off % 60 === 0
          ? `${off / 60} hour${off / 60 === 1 ? "" : "s"} before`
          : `${off} minutes before`;
    return {
      offsetMinutes: off,
      dueAt,
      label,
      status: markSent || dueAt.getTime() < now ? "SENT" : "PENDING",
      sentAt: markSent || dueAt.getTime() < now ? dueAt : null,
    };
  });
}

function rsvps(going, interested, no) {
  const out = [];
  let n = 0;
  const push = (count, status) => {
    for (let i = 0; i < count; i++) {
      n++;
      out.push({
        userId: `u${n}`,
        username: `member${n}`,
        status,
      });
    }
  };
  push(going, "GOING");
  push(interested, "INTERESTED");
  push(no, "NO");
  return out;
}

async function main() {
  await prisma.guild.upsert({
    where: { id: GUILD_ID },
    create: {
      id: GUILD_ID,
      name: "CyLiis",
      timezone: TZ,
      memberCount: 342,
      defaultChannelId: "c_events",
    },
    update: { name: "CyLiis", memberCount: 342, defaultChannelId: "c_events" },
  });

  for (const [i, c] of channels.entries()) {
    await prisma.channel.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        guildId: GUILD_ID,
        name: c.name,
        type: "GuildText",
        position: i,
        isTextable: true,
      },
      update: { name: c.name, position: i, isTextable: true, archived: false },
    });
  }

  // Fresh demo events each run.
  await prisma.event.deleteMany({ where: { guildId: GUILD_ID } });

  const defaults = [
    { kind: "MEETING", offsetMinutes: 60, label: "1 hour before" },
    { kind: "MEETING", offsetMinutes: 15, label: "15 minutes before" },
    { kind: "EVENT", offsetMinutes: 3 * 24 * 60, label: "3 days before" },
    { kind: "EVENT", offsetMinutes: 24 * 60, label: "1 day before" },
    { kind: "CUSTOM", offsetMinutes: 60, label: "1 hour before" },
  ];
  for (const d of defaults) {
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

  const events = [
    {
      title: "Weekly Robotics Sync",
      kind: "MEETING",
      description: "Progress updates on the competition robot and next steps.",
      startAt: new Date(now + 2 * DAY + 3 * HOUR),
      channelId: "c_hardware",
      location: "tehnic-voice",
      offsets: [60, 15],
      rsvp: [9, 4, 1],
      interested: 6,
    },
    {
      title: "Robotics Festival 2026",
      kind: "EVENT",
      description:
        "Our biggest public showcase of the year. Demos, workshops and sponsors.",
      startAt: new Date(now + 21 * DAY),
      channelId: "c_festival",
      location: "City Expo Hall",
      url: "https://example.com/festival",
      offsets: [3 * 24 * 60, 24 * 60],
      rsvp: [58, 31, 4],
      interested: 47,
    },
    {
      title: "Sponsor Call — Acme Corp",
      kind: "MEETING",
      description: "Quarterly check-in with our lead sponsor.",
      startAt: new Date(now + 6 * HOUR),
      channelId: "c_branding",
      offsets: [60, 15],
      rsvp: [4, 1, 0],
      interested: 2,
    },
    {
      title: "3D Printing Workshop",
      kind: "EVENT",
      description: "Hands-on intro to slicing and printing parts.",
      startAt: new Date(now - 5 * DAY),
      channelId: "c_printing",
      location: "Lab 2",
      offsets: [24 * 60, 60],
      rsvp: [22, 8, 5],
      interested: 18,
      past: true,
    },
  ];

  for (const e of events) {
    await prisma.event.create({
      data: {
        guildId: GUILD_ID,
        title: e.title,
        description: e.description,
        kind: e.kind,
        startAt: e.startAt,
        endAt: new Date(e.startAt.getTime() + 2 * HOUR),
        location: e.location ?? null,
        url: e.url ?? null,
        channelId: e.channelId,
        announceOnCreate: true,
        interestedCount: e.interested ?? 0,
        discordScheduledEventId: e.past ? null : `se_${e.title.length}`,
        reminders: {
          create: reminders(e.startAt, e.offsets, { markSent: e.past }),
        },
        rsvps: { create: rsvps(...e.rsvp) },
      },
    });
  }

  const count = await prisma.event.count({ where: { guildId: GUILD_ID } });
  console.log(`[seed-demo] done: ${channels.length} channels, ${count} events`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
