import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — CyLiis Remora",
  description:
    "How CyLiis Remora collects, uses and deletes data for the CyLiis robotics team.",
};

const UPDATED = "1 August 2026";
const CONTACT = "contact@cyliis.ro";

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-xl font-semibold text-neutral-100">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-neutral-400">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-10 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-100">
          Privacy Policy
        </h1>
        <p className="text-sm text-neutral-500">Last updated {UPDATED}</p>
      </header>

      <Section title="Who we are">
        <p>
          CyLiis Remora (&quot;Remora&quot;) is an internal coordination tool
          built and operated by the CyLiis robotics team. It schedules meetings
          and events for our Discord server, keeps them in sync with Google
          Calendar, and records who attends. It is not a public product and is
          not offered to third parties.
        </p>
        <p>
          For anything in this policy, contact us at{" "}
          <a className="text-brand hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </p>
      </Section>

      <Section title="What we collect">
        <p>
          <strong className="text-neutral-200">Discord account data.</strong>{" "}
          When a team member signs in or responds to a meeting, we store their
          Discord user ID, username, server nickname and avatar image URL. Sign
          in is limited to members of our own Discord server.
        </p>
        <p>
          <strong className="text-neutral-200">Attendance data.</strong>{" "}
          Responses to meeting invitations, any written reason submitted with an
          excused absence, and a record of meetings a member was expected at but
          did not answer.
        </p>
        <p>
          <strong className="text-neutral-200">Instagram messages.</strong> If
          enabled, direct messages sent to the CyLiis Instagram account are
          received through Meta&apos;s Instagram messaging API and reposted into
          a private channel of our Discord server so the team can respond. This
          covers the sender&apos;s Instagram handle, the message text and any
          attached media. We do not forward story replies or story mentions, we
          do not read message history, and we never send replies through the
          API.
        </p>
        <p>
          <strong className="text-neutral-200">Schedule content.</strong> Titles,
          descriptions, locations and times of meetings and events, plus files
          submitted for 3D print requests.
        </p>
      </Section>

      <Section title="Why we use it">
        <p>
          Solely to run the team: announcing meetings, sending reminders,
          tracking who attends, managing print requests, and making sure
          messages sent to our Instagram account reach the right people. We do
          not use this data for advertising or profiling, we do not sell it, and
          we do not share it with third parties for their own purposes.
        </p>
      </Section>

      <Section title="Services we rely on">
        <p>
          Data passes through Discord (messaging and authentication), Google
          Calendar (schedule sync), Meta&apos;s Instagram API (incoming direct
          messages) and Render (hosting and database). Each processes data under
          its own privacy policy.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Schedules and attendance records are kept while they remain useful to
          the team, so past participation stays available for planning.
          Forwarded Instagram messages live in Discord and are subject to
          Discord&apos;s retention. Everything is deleted on request.
        </p>
      </Section>

      <Section title="Data deletion" id="data-deletion">
        <p>
          To have your data removed, email{" "}
          <a className="text-brand hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>{" "}
          from the address associated with your account, or send a direct
          message to a team administrator on Discord, stating your Discord
          username or Instagram handle. We will delete your records within 30
          days and confirm once it is done.
        </p>
        <p>
          You can also revoke Remora&apos;s access to an Instagram account at any
          time from Instagram: Settings → Website permissions → Apps and
          websites.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes we will update the date at the top of this
          page.
        </p>
      </Section>
    </main>
  );
}
