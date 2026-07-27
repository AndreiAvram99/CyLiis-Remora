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
| Access control | Login limited to server members; a `Remora` role grants full management, everyone else is view-only |

## Architecture

The **dashboard is the only writer**; the **worker is the only actor**. They
communicate exclusively through Postgres, which keeps deployment simple and
resilient (no web to bot RPC, no Redis).

```
Dashboard (Next.js)  --writes-->  Postgres  <--reads--  Worker (discord.js + scheduler)
     |                                                        |
     +--> Google Calendar API                                +--> Discord channels / scheduled events
```

- `apps/dashboard` - Next.js dashboard (events CRUD, settings, presence), Discord
  OAuth login, Google Calendar sync.
- `apps/worker` - discord.js bot: syncs channels, posts reminders/announcements,
  handles RSVP buttons, creates Discord Scheduled Events, and runs the polling
  reminder scheduler.
- `packages/db` - shared Prisma schema + client.
- `packages/shared` - shared helpers (offset/unit conversions, RSVP button ids).

## How it works

- You create an event in the dashboard, choosing its **type** (Meeting / Event /
  Custom), **channel**, start time, and one or more **reminders** (value + unit,
  e.g. `15 minutes` before or `3 days` before).
- Saving writes the event + reminders to Postgres and mirrors it to Google
  Calendar. "Announce on create" adds an immediate announcement post.
- The worker polls every 30s (configurable). Any reminder whose `dueAt` has
  passed is delivered to its channel with an embed and RSVP buttons, then marked
  `SENT`.
- RSVP button clicks are stored per user and shown live on the message and in the
  **Presence** tab, which lists exactly which members are going / can't make it /
  motivation for each event. Each event also gets a native Discord Scheduled Event
  so you benefit from Discord's built-in "interested" count and notifications.

## 1. Discord app setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   and create a **New Application**.
2. **Bot** tab: add a bot, copy the **token** -> `DISCORD_BOT_TOKEN`. Enable no
   privileged intents are required (the bot uses the default `Guilds` +
   `GuildScheduledEvents` intents only).
3. **OAuth2** tab: copy **Client ID** -> `DISCORD_CLIENT_ID` and **Client
   Secret** -> `DISCORD_CLIENT_SECRET`.
4. Under **OAuth2 -> Redirects**, add:
   - `http://localhost:3000/api/auth/callback/discord` (local)
   - `https://YOUR-DASHBOARD.onrender.com/api/auth/callback/discord` (prod)
5. Invite the bot with an OAuth2 URL using scopes `bot applications.commands` and
   permissions: **View Channels, Send Messages, Embed Links, Manage Events**.
6. Get your **server (guild) id** (enable Developer Mode -> right-click server ->
   Copy Server ID) -> `DISCORD_GUILD_ID`.
7. Get your own **user id** (right-click yourself -> Copy User ID) ->
   `ADMIN_DISCORD_IDS` (comma-separated). These users are always full managers.

### Access control

- **Login is limited to members of your server.** At sign-in the app checks
  membership via the Discord OAuth `guilds.members.read` scope (no extra setup —
  NextAuth requests it automatically). Non-members are rejected.
- **Create a role named `Remora`** in your Discord server. Members with
  that role (plus anyone in `ADMIN_DISCORD_IDS`) can create/edit/delete events
  and change settings. All other members can log in but only **view** Events and
  Presence.
- The role is matched by name using the bot token. To use a different name set
  `MANAGER_ROLE_NAME`, or pin exact ids with `MANAGER_ROLE_ID`.

## 2. Google Calendar setup (service account)

1. In the [Google Cloud Console](https://console.cloud.google.com/), create/pick
   a project and enable the **Google Calendar API**.
2. Create a **Service Account** and a **JSON key**. Paste the full JSON into
   `GOOGLE_SERVICE_ACCOUNT_JSON` (raw JSON, or base64-encoded).
3. In Google Calendar, create (or pick) a calendar, open its **Settings ->
   Share with specific people**, and add the service account email
   (`...@...iam.gserviceaccount.com`) with **Make changes to events**.
4. Copy that calendar's **Calendar ID** (Settings -> Integrate calendar) ->
   `GOOGLE_CALENDAR_ID`. Events created in the dashboard will appear there.

Set `GOOGLE_CALENDAR_ENABLED=false` to disable calendar sync entirely.

## 3. Local development

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env
#   -> fill in DATABASE_URL (a local Postgres), Discord + Google values

# 3. Set up the database
npm run db:generate
npm run db:migrate      # applies migrations to your local DB
npm run db:seed         # seeds the guild + default reminders

# 4. Run (two terminals)
npm run dev:dashboard   # http://localhost:3000
npm run dev:worker      # starts the bot + scheduler
```

The worker must be running at least once so it can sync your channels into the
DB; then the dashboard channel picker will populate.

## 4. Deploy to Render

This repo ships a [`render.yaml`](render.yaml) blueprint that provisions:

- a **Postgres** database,
- a **Web Service** (dashboard), and
- a **Background Worker** (bot + scheduler).

Steps:

1. Push this repo to GitHub.
2. In Render: **New -> Blueprint**, point it at the repo. Render reads
   `render.yaml`.
3. Fill in the secret env vars it prompts for (they are in the
   `discord-cal-shared` group + per-service):
   - `DISCORD_GUILD_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`,
     `DISCORD_CLIENT_SECRET`
   - `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID`
   - `ADMIN_DISCORD_IDS`
   - `NEXTAUTH_URL` = your dashboard URL, e.g.
     `https://discord-cal-dashboard.onrender.com`
4. `DATABASE_URL` and `NEXTAUTH_SECRET` are wired/generated automatically.
5. Deploy. The web service runs `prisma migrate deploy` + seed before starting.
6. Add the production OAuth redirect URL in the Discord portal (step 1.4).

## Environment variables

See [`.env.example`](.env.example) for the full annotated list.

## Presence tracking

- **RSVP buttons** (Going / Can't make it / Motivation) on every announcement and
  reminder record each member's response. "Motivation" marks an excused absence.
- The **Presence** tab lists, per event, exactly which members are going, can't
  make it, or have a motivated absence — by name, not just counts.
- **Managers can correct presence.** If a member's RSVP doesn't match reality, a
  manager can change their status or remove them directly from the Presence tab;
  admin-adjusted entries are flagged.
- **Discord Scheduled Events** are created per event for native interest tracking
  and notifications.
- **Reminder delivery status** (sent / pending / failed) is tracked per reminder.
- **PDF export.** Download a presence report for a single event or for all events
  straight from the Presence tab (`Export all (PDF)` / per-event `PDF` link).

Ideas to extend: a post-event "who actually attended" check-in, and importing
participation from Discord voice-channel presence during the event.

## Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev:dashboard` | Run the dashboard locally |
| `npm run dev:worker` | Run the bot + scheduler locally |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:deploy` | Apply migrations (prod) |
| `npm run db:seed` | Seed guild + default reminders |
| `npm run db:studio` | Open Prisma Studio |
| `npm run build` | Build both apps |
