import Link from "next/link";
import {
  BadgeCheck,
  CalendarRange,
  FileText,
  Hash,
  Instagram,
  LifeBuoy,
  ListChecks,
  type LucideIcon,
  Palette,
  Printer,
  ShieldCheck,
  SlidersHorizontal,
  TerminalSquare,
  Trophy,
  Users,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { getSession, isMasterId } from "@/lib/session";

export const dynamic = "force-dynamic";

const TONES: Record<string, string> = {
  sky: "bg-palette-sky/10 text-palette-sky",
  sun: "bg-palette-sun/10 text-palette-sun",
  azure: "bg-palette-azure/10 text-palette-azure",
  flame: "bg-palette-flame/10 text-palette-flame",
};

function Section({
  id,
  icon: Icon,
  title,
  lead,
  tone = "azure",
  badge,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  lead: string;
  tone?: keyof typeof TONES;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24 space-y-4">
      <div className="flex items-start gap-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${TONES[tone]}`}
        >
          <Icon size={20} />
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium text-neutral-100">{title}</h2>
            {badge ? (
              <Badge className="bg-neutral-800 text-neutral-400">{badge}</Badge>
            ) : null}
          </div>
          <p className="text-sm text-neutral-400">{lead}</p>
        </div>
      </div>
      <ul className="space-y-2.5 sm:pl-[3.75rem]">{children}</ul>
    </Card>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-neutral-300">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-700" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** Inline status pill, matching the colors used across the dashboard. */
function Pill({ tone, children }: { tone: "azure" | "sun"; children: string }) {
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

function Key({ children }: { children: string }) {
  return (
    <code className="rounded-md bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-200">
      {children}
    </code>
  );
}

export default async function HelpPage() {
  const session = await getSession();
  const isManager = Boolean(session?.user?.isManager);
  const isOwner = isMasterId(session?.user?.discordId);

  const jump = [
    { id: "answering", label: "Answering" },
    { id: "commands", label: "Discord commands" },
    { id: "calendar", label: "Calendar" },
    { id: "presence", label: "Presence" },
    { id: "marks", label: "Marks" },
    { id: "instagram", label: "Instagram" },
    { id: "printing", label: "Printing" },
    { id: "account", label: "Your account" },
    ...(isManager
      ? [
          { id: "scheduling", label: "Creating schedules" },
          { id: "agenda", label: "Agendas" },
          { id: "channels", label: "Channel rules" },
          { id: "settings", label: "Server settings" },
        ]
      : []),
    ...(isOwner ? [{ id: "owner", label: "Owner tools" }] : []),
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
          How Remora works
        </h1>
        <p className="max-w-2xl text-sm text-neutral-400">
          Remora announces the team&apos;s meetings, events and prints in
          Discord and keeps track of who showed up. You answer where it&apos;s
          convenient — in Discord — and this dashboard is where everything is
          collected.
        </p>
        <p className="text-sm text-neutral-500">
          You&apos;re signed in as{" "}
          <span className="text-neutral-300">
            {isOwner ? "the owner" : isManager ? "a Remora-Admin" : "a member"}
          </span>
          {isManager
            ? " — you can create and edit schedules, and this page shows those tools too."
            : " — you can see everything here and answer in Discord."}
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5">
        {jump.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-lg border border-[rgb(var(--line))] px-3 py-1.5 text-xs text-neutral-400 transition hover:text-neutral-100"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <Section
        id="answering"
        icon={BadgeCheck}
        tone="azure"
        title="Answering a meeting or event"
        lead="Every announcement in Discord carries two buttons. That's the whole flow."
      >
        <Point>
          <Pill tone="azure">Going</Pill> means you&apos;ll be there.{" "}
          <Pill tone="sun">Motivation</Pill> opens a small box where you write
          why you can&apos;t make it.
        </Point>
        <Point>
          Your reason is posted in <Key>#chat-de-scuze</Key> so the team sees it
          without anyone having to ask.
        </Point>
        <Point>
          You can answer until the meeting starts. After that the buttons stop
          accepting replies, so answer early rather than at the door.
        </Point>
        <Point>
          Changed your mind? Tap the other button — the last answer counts, and
          the announcement updates itself.
        </Point>
        <Point>
          Meetings with a set attendee list only accept answers from people on
          it. If you think you should be there, ask a Remora-Admin to add you.
          Events are open to everyone.
        </Point>
      </Section>

      <Section
        id="commands"
        icon={TerminalSquare}
        tone="sky"
        title="Two commands in Discord"
        lead="Faster than opening the dashboard when you just want to know what's next."
      >
        <Point>
          <Key>/today</Key> lists everything scheduled today, with your status
          next to each one.
        </Point>
        <Point>
          <Key>/week</Key> covers the next 7 days and shows only what you&apos;re
          expected at. Add <Key>all: true</Key> to see everything.
        </Point>
        <Point>
          Both replies are private. Add <Key>share: true</Key> to post the list
          for the whole channel instead.
        </Point>
        <Point>
          The private reply has <Pill tone="azure">Going</Pill> and{" "}
          <Pill tone="sun">Motivation</Pill> buttons, so you can answer without
          hunting for the original announcement.
        </Point>
      </Section>

      <Section
        id="calendar"
        icon={CalendarRange}
        tone="sun"
        title="Calendar, and getting it on your phone"
        lead="A month at a glance, colored by the channel each schedule belongs to."
      >
        <Point>
          <Link href="/calendar" className="text-brand hover:underline">
            Calendar
          </Link>{" "}
          shows meetings and events — print requests stay out of it.
        </Point>
        <Point>
          The <span className="text-neutral-100">Subscribe</span> button adds
          Remora to your phone&apos;s calendar app. It keeps itself in sync, so
          new schedules show up on their own.
        </Point>
        <Point>
          Every meeting also lands in the team&apos;s Google Calendar, including
          repeats.
        </Point>
      </Section>

      <Section
        id="presence"
        icon={Users}
        tone="azure"
        title="Presence"
        lead="Who answered what, grouped by channel, plus who's still silent."
      >
        <Point>
          Each card lists people who are <Pill tone="azure">Going</Pill> and
          those with a <Pill tone="sun">Motivation</Pill>, with the reason they
          gave.
        </Point>
        <Point>
          The red zone at the bottom is people expected at the meeting who
          haven&apos;t answered — &quot;waiting on a reply&quot; before it
          starts, &quot;missed the meeting&quot; after.
        </Point>
        <Point>
          Anyone can export a PDF: one schedule at a time, or a date range using
          the From/To filter.
        </Point>
        {isManager ? (
          <Point>
            As a Remora-Admin you can correct someone&apos;s status or remove
            them. Corrected entries are marked so it&apos;s clear they were set
            by hand.
          </Point>
        ) : null}
      </Section>

      <Section
        id="marks"
        icon={Trophy}
        tone="flame"
        title="Black marks, white marks, leaderboard"
        lead="A running tally per person, not a per-meeting score."
      >
        <Point>
          A black mark lands when you were expected at a meeting and never
          answered before it started. Answering{" "}
          <Pill tone="sun">Motivation</Pill> avoids it — an excused absence is
          not a miss.
        </Point>
        <Point>
          White marks are credits the owner adds by hand, for example when you
          covered something for the team. Your standing is black minus white.
        </Point>
        <Point>
          <Link href="/leaderboard" className="text-brand hover:underline">
            Leaderboard
          </Link>{" "}
          sorts either by attendance or by marks, and shows going, motivated,
          missed and your attendance rate.
        </Point>
        <Point>
          A mark you think is wrong is usually a missing answer. Ask a
          Remora-Admin to set your status on Presence — the mark clears with it.
        </Point>
      </Section>

      <Section
        id="instagram"
        icon={Instagram}
        tone="flame"
        title="Instagram messages"
        lead="Direct messages to the team account, forwarded so nobody has to watch the inbox."
      >
        <Point>
          Each DM arrives in Discord as a highlighted message with the
          sender&apos;s handle and picture. Nobody gets pinged.
        </Point>
        <Point>
          Tap <span className="text-neutral-100">Mark as read</span> on the
          Discord message when you&apos;ve handled it — your name is then shown
          on it, so two people don&apos;t answer the same person.
        </Point>
        <Point>
          The{" "}
          <Link href="/instagram" className="text-brand hover:underline">
            Instagram
          </Link>{" "}
          tab keeps the full history, tells you how many are still waiting, and
          can filter by sender.
        </Point>
      </Section>

      <Section
        id="printing"
        icon={Printer}
        tone="sky"
        title="Print requests"
        lead="Files that need printing, with someone always visibly responsible."
      >
        <Point>
          A request lists each file with filament, infill, walls, color, support
          and how many copies. New files start from the defaults set in
          Settings, so usually there&apos;s nothing to adjust.
        </Point>
        <Point>
          Drop in as many files as you like — Discord takes ten attachments per
          message, so the rest follow underneath the request automatically.
        </Point>
        <Point>
          In Discord, the first person to tap{" "}
          <span className="text-neutral-100">
            &quot;I&apos;ll take care of it&quot;
          </span>{" "}
          claims it and the job moves to Printing. Their second tap marks it
          Done.
        </Point>
        <Point>
          The Printing tab on{" "}
          <Link href="/events" className="text-brand hover:underline">
            Schedules
          </Link>{" "}
          shows what&apos;s pending, who claimed it and what&apos;s finished.
        </Point>
      </Section>

      <Section
        id="account"
        icon={Palette}
        tone="sun"
        title="Making it yours"
        lead="Small preferences, stored in the browser you're using."
      >
        <Point>
          <Link href="/account" className="text-brand hover:underline">
            Account
          </Link>{" "}
          is where you pick light, dark or system, upload a picture, and choose
          the color behind your initials.
        </Point>
        <Point>
          These settings don&apos;t follow you to another device — they live in
          this browser only.
        </Point>
      </Section>

      {isManager ? (
        <>
          <Section
            id="scheduling"
            icon={ListChecks}
            tone="azure"
            badge="Remora-Admin"
            title="Creating a schedule"
            lead="Three kinds, one form: a meeting, an event, or a print request."
          >
            <Point>
              A meeting takes a start time and a duration. An event takes a
              start and end date. Printing takes files instead of dates.
            </Point>
            <Point>
              Repeat weekly, monthly or yearly and Remora creates the next
              occurrence once the current one passes. Past attendance stays
              untouched.
            </Point>
            <Point>
              For meetings, pick the expected attendees. The role chips at the
              top invite everyone holding a role in one tap — tap again to drop
              them — or tick people individually.
            </Point>
            <Point>
              Anyone expected who doesn&apos;t answer before the start shows up
              in the red zone on Presence and picks up a black mark.
            </Point>
            <Point>
              Reminders can go out at any offset before the start, each in its
              own channel if you want. The tag picker decides who gets pinged —
              roles, individual members, or nobody.
            </Point>
            <Point>
              Editing a saved schedule posts an update message in Discord
              listing what changed, so nobody works from the old time.
            </Point>
            <Point>
              Deleting is reserved for the owner, so nothing disappears by
              accident.
            </Point>
          </Section>

          <Section
            id="agenda"
            icon={FileText}
            tone="sun"
            badge="Remora-Admin"
            title="Meeting agendas in Google Docs"
            lead="One button on a meeting card, and the document is waiting for you."
          >
            <Point>
              <span className="text-neutral-100">Agenda</span> creates a Google
              Doc named after the meeting, with an{" "}
              <span className="text-neutral-100">Agenda</span> tab and a{" "}
              <span className="text-neutral-100">Resume</span> tab nested under
              it, both dated.
            </Point>
            <Point>
              It&apos;s filed in the team folder that matches the channel —
              announcements go to General, and the rest match their own name.
            </Point>
            <Point>
              A repeating meeting keeps one document. Press the button on each
              occurrence and it adds that date&apos;s pair of tabs, in order.
            </Point>
            <Point>
              If the document is deleted in Drive, the button quietly builds a
              new one instead of sending you to a dead link.
            </Point>
          </Section>

          <Section
            id="channels"
            icon={Hash}
            tone="flame"
            badge="Remora-Admin"
            title="Where you can post"
            lead="A couple of channels have rules, so announcements stay meaningful."
          >
            <Point>
              <Key>#printing</Key> only takes print requests — meetings and
              events can&apos;t be scheduled there.
            </Point>
            <Point>
              <Key>#announcements</Key> needs the Announcements role. Without
              it, the channel simply isn&apos;t offered in the picker.
            </Point>
            <Point>
              A schedule already living in a channel stays editable, even if you
              couldn&apos;t have posted there yourself.
            </Point>
          </Section>

          <Section
            id="settings"
            icon={SlidersHorizontal}
            tone="sky"
            badge="Remora-Admin"
            title="Server settings"
            lead="The defaults everyone else inherits."
          >
            <Point>
              <Link href="/settings" className="text-brand hover:underline">
                Settings
              </Link>{" "}
              sets the timezone every date on the dashboard is shown in.
            </Point>
            <Point>
              Default reminders for meetings and events pre-fill the form, so
              you rarely have to think about them.
            </Point>
            <Point>
              Channel colors decide how schedules are tinted on the Calendar and
              in Google Calendar.
            </Point>
          </Section>
        </>
      ) : null}

      {isOwner ? (
        <Section
          id="owner"
          icon={ShieldCheck}
          tone="flame"
          badge="Owner"
          title="Things only you can do"
          lead="The destructive and the corrective, kept on one account."
        >
          <Point>Delete schedules and print requests.</Point>
          <Point>
            Set a status on Presence for someone who never answered, which also
            clears their black mark.
          </Point>
          <Point>
            Add or remove black and white marks by hand from the Leaderboard,
            with a reason.
          </Point>
          <Point>
            Open a name in the Leaderboard to see where each of their marks came
            from, and clear any of them — including one earned by missing a
            meeting.
          </Point>
          <Point>
            Mark Instagram messages as read or delete them from the dashboard,
            which removes them from Discord too.
          </Point>
        </Section>
      ) : null}

      <Card className="flex flex-wrap items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-800 text-neutral-300">
          <LifeBuoy size={20} />
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-medium text-neutral-100">
            Still stuck?
          </h2>
          <p className="text-sm text-neutral-400">
            Ask a Remora-Admin in Discord. If something looks broken rather than
            confusing — a missing answer, a mark that shouldn&apos;t be there —
            they can fix it from the dashboard in a few seconds.
          </p>
        </div>
      </Card>
    </div>
  );
}
