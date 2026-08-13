# CyLiis Remora — Discord Events & Meetings Manager

**CyLiis Remora turns a busy Discord server into an organized, calendar-driven community.**
Plan meetings and events from a clean web dashboard, let a bot handle the
reminders in the right channels at the right time, keep everything mirrored in
Google Calendar, and see exactly which members show up.

## Why this exists

Community and team servers live and die by attendance. The usual workflow —
someone manually pinging `@everyone` in a channel, hoping people notice, and
having no idea who's coming — is noisy, easy to forget, and impossible to
measure. Different things also need different lead times: a stand-up meeting
needs a nudge **15 minutes** before, while a festival or workshop needs a heads-up
**days** in advance.

CyLiis Remora fixes this by separating _planning_ from _delivery_:

- You **plan once** in a dashboard (what, when, which channel, how far ahead to
  remind).
- The bot **delivers reliably** — posting announcements and timed reminders,
  collecting RSVPs, and creating native Discord events — without anyone lifting a
  finger.
- You **see who's in** — a per-event Presence view lists exactly which members
  are going, can't make it, or have a motivated absence.

## What makes it different

- **Per-type, multi-stage reminders.** Meetings, Events, and Custom types each
  carry their own default lead times, and every event can stack several reminders
  (e.g. `3 days`, then `1 day`, then `1 hour` before).
- **Channel-aware.** Every event targets a specific channel, and individual
  reminders can even be redirected to a different channel.
- **Two-way visibility.** Events are mirrored to Google Calendar so they show up
  in everyone's normal calendar app, not just in Discord.
- **Named presence tracking.** RSVP buttons + native Discord Scheduled Events
  feed a Presence tab that lists the actual members participating in each event —
  not just counts, but names.
- **A design that can't drift.** The dashboard is the single source of truth and
  the only writer; the bot is the only actor. They never call each other — they
  meet in the database. That makes the system easy to reason about, cheap to host,
  and hard to get into an inconsistent state.

## Feature highlights

| Area | What you get |
| --- | --- |
| Scheduling | Create/edit/delete events with type, channel, start/end, location & link |
| Reminders | Unlimited reminders per event, `minutes` / `hours` / `days` lead times, per-type defaults |
| Announcements | Optional instant announcement post with RSVP buttons on save |
| Google Calendar | Automatic create/update/delete sync via a service account |
| Presence | Per-event list of who is going / can't make it / motivation, by member name |
| Reliability | Delivery status per reminder (sent / pending / failed), idempotent polling scheduler |
| Access control | Login limited to server members; a `Remora-Admin` role grants full management, everyone else is view-only |

## Using it

Remora is hosted, so there is nothing to install: members open the dashboard and
sign in with Discord. Everything else is documented inside the app itself — the
**Help** page walks through answering meetings, presence, marks, agendas and
print requests, and it stays in step with the version you are actually using.

## Licence

Proprietary — all rights reserved. See [LICENSE](LICENSE). Read access to this
repository is not permission to run, copy or deploy the software.
