# CLAUDE.md

Gistroom. The single source of truth for how this product is built, how it looks, how it sounds and how every change is verified. Read all of it before you write any code. Re-read the relevant sections before starting each phase.

Owner: Kenny (@oyedokunken, https://www.oyedokun.dev/). Gistroom is built by @oyedokunken, not by any company. Personal showcase project, built to production standard. The owner develops on Windows (PowerShell), so every script must run there.

---

## 0. How to work (read first)

1. This file beats your defaults. If the owner asks for something that conflicts with this file, follow the owner, then update this file in the same change so it never lies.
2. Do the work yourself. Run installs, scaffolding, generators, migrations (against the dev schema), asset builds and tests. Only stop and ask for: secrets you cannot create, accounts the owner must open, or items in Section 27.
3. After every change, run `npm run verify:changed` (only the checks your files need). Before a release, a push that touches shared code, or when asked, run the full `npm run verify`. Never say a task is done until the checks you ran are green. Report what ran and what passed in two or three lines.
4. Work in vertical slices (schema, API, realtime, UI, tests, docs together). Commit after each green slice.
5. Plan first for anything big. Write a short plan (what, files, risks), then build, then critique your own result against this file. Remove one decoration before calling a screen finished.
6. Never invent facts in product copy: no made-up user counts, testimonials, company logos, awards or press. Sample content must be labeled as sample.
7. Keep this file, the README, the wiki and the CHANGELOG current. A feature without docs is not done.
8. When something here is ambiguous, pick the safest reading, note it under "Decisions" in `wiki/Decisions.md`, and keep moving.

---

## 1. Product

**Gistroom** is a web app (PWA) for Nigerians to talk, live, about things in Nigeria. Domain: `gistroom.ng`.

What it does:

- Friends: search people by name, send a request, chat only once the request is accepted.
- Chats (DMs): bubbles with timestamps, emoji, voice notes, images, videos, files, starred messages, archive, delete.
- Calls: 1:1 audio or video, switch between them mid-call.
- Rooms: group calls created on the fly, public or private, with moderators. A Room disbands when it ends. DMs stay forever.
- Notifications: heavy and reliable, in-app and Web Push, including when the browser tab was closed since last night.
- Public discover page of live public Rooms with topic and language filters.

Principles:

- Audio first, video optional. Nigerian data is expensive and networks are uneven.
- Nigeria is the identity, not a skin. It shows in the illustrations, the copy, the defaults (data saver, WAT-aware times, Naira-safe typography) and the topics.
- Warm and inviting ("fanimorous"). A stranger on the landing page should want to try it within ten seconds.
- Safe by design: block, report, moderators, private Rooms, rate limits.
- "Nigerians only" is a product identity, not an enforced gate. Never claim verification you do not do.

---

## 2. Hard rules (non-negotiable)

Each rule has an ID. The verify pipeline enforces most of them. Cite the ID in code review comments.

| ID  | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | No emojis in source, copy, docs, commit messages, emails, UI or tests. Use Lucide icons or PNG art instead. The only emoji allowed anywhere is user-generated content in chats, which comes from the emoji picker at runtime. In tests, write emoji as escapes (for example `"\u{1F600}"`).                                                                                                                                                                                                                                  |
| R2  | No em dashes (U+2014), no en dashes (U+2013), no horizontal bar (U+2015), no figure dash (U+2012) anywhere: source, copy, docs, emails, commit messages. Use a comma, a colon, a full stop or a hyphen.                                                                                                                                                                                                                                                                                                                      |
| R3  | Icons: Lucide only (`lucide-react`). The Google "G" mark and the logo are the only inline brand SVG exceptions.                                                                                                                                                                                                                                                                                                                                                                                                              |
| R4  | No toasts. Never install or import a toast library. Form errors are inline under the field. Form-level and system feedback uses modals through the shared `FeedbackProvider` (`showInfo`, `showError`, `showSuccess`, `confirm`). Connection state uses an inline banner, not a toast. Exception: in-call and in-Room activity chips, which live only inside those screens, auto-dismiss, are announced with `aria-live="polite"`, and never carry actions. The ban on toast libraries stays; the chip component is our own. |
| R5  | Validation is Zod plus React Hook Form (`@hookform/resolvers/zod`). Every `<form>` has `noValidate`. No HTML validation attributes on inputs: no `required`, `pattern`, `minLength`, `maxLength`, `min`, `max`, `type="email"` validation reliance. Use `inputMode` and `autoComplete` freely.                                                                                                                                                                                                                               |
| R6  | No native `<select>`. Use the shared `Select` or `Combobox` components.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| R7  | Prisma is the only database access layer. No raw SQL except in migrations and the two documented trigram search queries.                                                                                                                                                                                                                                                                                                                                                                                                     |
| R8  | One command to develop: `npm run dev`. No Docker, no embedded Postgres, no separate local environment, no `dev:local`, no extra local test file. Dev and tests use the hosted Supabase project through isolated schemas (Section 5.3).                                                                                                                                                                                                                                                                                       |
| R9  | Nigerian copy, plain and warm, light slang in the right places (Section 18). Sentence case. Active voice. Errors say what happened and what to do, and never apologize.                                                                                                                                                                                                                                                                                                                                                      |
| R10 | All user-facing strings live in `apps/web/src/content/` (and `packages/shared/src/content/` for strings the realtime service sends). Components import strings, they do not inline them. Do not install an i18n library yet. English only for now.                                                                                                                                                                                                                                                                           |
| R11 | Design tokens only. No raw hex colors, raw font names or magic spacing outside `tokens`. Tailwind classes map to tokens.                                                                                                                                                                                                                                                                                                                                                                                                     |
| R12 | Font is Graphik, self-hosted (Section 14). No Google Fonts, no CDN fonts.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R13 | Illustrations are PNG art with no baked-in text (Section 17). Never use stock photos of people in offices, never use emoji as decoration.                                                                                                                                                                                                                                                                                                                                                                                    |
| R14 | Every public page is server rendered with full metadata and passes the SEO checks in Section 12.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| R15 | Every media upload is private, validated by magic bytes, size-capped, and served by short-lived signed URL. No public bucket for chat media. Strip GPS and EXIF from images.                                                                                                                                                                                                                                                                                                                                                 |
| R16 | Every socket event is authorized individually, not just at connection time.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R17 | Every mutation is rate limited, idempotent where retries are possible (client-generated IDs), and authorized on the server.                                                                                                                                                                                                                                                                                                                                                                                                  |
| R18 | Motion respects `prefers-reduced-motion`: animations snap to their final state. Animate transform and opacity only.                                                                                                                                                                                                                                                                                                                                                                                                          |
| R19 | WCAG AA: visible focus, 44px touch targets, labelled controls, correct contrast. Yellow is never text on white (Section 13).                                                                                                                                                                                                                                                                                                                                                                                                 |
| R20 | Secrets never reach the client or the repo. `.env` is git-ignored. Only `NEXT_PUBLIC_*` values are exposed.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R21 | Commit messages: one plain sentence, imperative mood, no prefixes required, no co-author trailers, no emojis, no dashes. Never commit with a failing verify.                                                                                                                                                                                                                                                                                                                                                                 |
| R22 | No `console.log`, no `any`, no `@ts-ignore` without a comment explaining why, no TODO without an issue number or a Decisions entry.                                                                                                                                                                                                                                                                                                                                                                                          |
| R23 | Windows safe: Node scripts (`.mjs` or `.ts`), `cross-env`, `concurrently`, `path.join`. No bash-only syntax in npm scripts. LF line endings via `.gitattributes`.                                                                                                                                                                                                                                                                                                                                                            |
| R24 | No new runtime dependency without a one-line reason in the PR or commit body and a check that it is maintained.                                                                                                                                                                                                                                                                                                                                                                                                              |

---

## 3. Stack

| Concern          | Choice                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Language         | TypeScript, `strict`, `noUncheckedIndexedAccess`                                                                                           |
| Package manager  | npm workspaces (Node 20 or newer, set `engines`)                                                                                           |
| Web              | Next.js App Router, React, Tailwind CSS v4, Motion (`motion/react`)                                                                        |
| Forms            | React Hook Form, Zod                                                                                                                       |
| Client data      | TanStack Query for server state, Zustand for ephemeral state (call state, composer drafts)                                                 |
| UI primitives    | Radix UI (Dialog, Popover, Tooltip, DropdownMenu, Tabs, Select), `vaul` for mobile bottom sheets, `@tanstack/react-virtual` for long lists |
| Icons            | `lucide-react`                                                                                                                             |
| Realtime service | Express, Socket.IO, TypeScript, `pino`, `web-push`                                                                                         |
| Audio and video  | LiveKit Cloud (`livekit-client`, `@livekit/components-react`, `livekit-server-sdk`)                                                        |
| Database         | PostgreSQL on Supabase, Prisma ORM                                                                                                         |
| File storage     | Supabase Storage (private bucket for media, public bucket for avatars only)                                                                |
| Auth             | Email and password (a one time code confirms the email at sign up and for resets) plus Google OAuth, DB-backed sessions                    |
| Email            | Nodemailer (Gmail SMTP for now), sends only from the web app                                                                               |
| PWA              | Serwist for the service worker (`@serwist/next`), Web App Manifest, Web Push (VAPID)                                                       |
| Charts           | Recharts (admin only)                                                                                                                      |
| Logging          | `pino` and `pino-http`. Not Morgan.                                                                                                        |
| Tests            | Vitest (unit, integration), Playwright with Chromium (browser, a11y with `@axe-core/playwright`), `socket.io-client` for socket tests      |
| Quality          | ESLint flat config (`typescript-eslint`, `jsx-a11y`, `no-restricted-imports`), Prettier, Husky, lint-staged                                |
| Hosting          | Exactly two deployments: Vercel (`apps/web`) and Render (`apps/realtime`). Supabase and LiveKit are hosted services, not deployments.      |

Use the latest stable versions at install time and let `package-lock.json` pin them. Do not add Python anywhere.

Auth is email and password plus Google (decision D1, Section 27). A one time code is used only to confirm the email at sign up, to reset a password and to confirm account deletion, never to sign in. Passwords are hashed with scrypt from Node, so there is no native dependency.

---

## 4. Repository layout

```
gistroom/
  CLAUDE.md
  README.md  SECURITY.md  CONTRIBUTING.md  CHANGELOG.md  LICENSE
  package.json                 workspaces, root scripts
  .env.example  .editorconfig  .gitattributes  .gitignore  .vercelignore
  eslint.config.mjs  prettier.config.mjs  tsconfig.base.json
  .husky/                      pre-commit, commit-msg, pre-push
  .github/workflows/ci.yml
  apps/
    web/                       Next.js, deployed to Vercel
      src/
        app/
          (public)/            landing, about, features, security, safety, support, install, legal, rooms, topics
          (auth)/              login, signup, verify, onboarding
          (app)/app/           authed shell: chats, rooms, calls, friends, notifications, settings, admin
          api/                 route handlers (REST)
          sw.ts                service worker source
          manifest.ts  robots.ts  sitemap.ts  opengraph-image.tsx  icon routes
        components/            ui, chat, call, room, landing, brand, feedback, notifications
        content/               all user-facing strings, FAQ, topics, alt text
        lib/                   client-safe helpers
        server/                server-only: modules, mailer, storage, livekit, push, auth, rate-limit
        fonts/graphik/         woff2 files used by next/font/local
      public/
        images/                optimized PNG art
        brand/                 logo files, favicon, PWA icons
    realtime/                  Express + Socket.IO, deployed to Render
      src/
        server.ts  sockets/  scheduler/  push/  http/  presence/
  packages/
    db/                        Prisma schema, client, migrations, seed
    shared/                    Zod schemas, event contracts, constants, shared content, types
  design/
    masters/                   original PNG masters and logo SVG sources
    assets.manifest.json       id, placement, size, alt, prompt, status
    PROMPTS.md                 generation prompts and style lock
    fonts/                     original Graphik files (ttf, woff2 only, see Section 14)
  scripts/                     check-copy.mjs, check-ui-rules.mjs, assert-safe-db.mjs, graphics/*, brand.mjs
  tests/
    unit/  integration/  browser/  a11y/  helpers/
  wiki/                        long-form docs
```

Rules for the layout:

- `packages/shared` is the contract between web and realtime. Event names, payload schemas and limits are defined once there.
- Web never imports from `apps/realtime`, and vice versa.
- `server/` folders are never imported by client code (enforce with ESLint `no-restricted-imports`).

---

## 5. Environment, deployment and database

### 5.1 Deployments

|                | Vercel                                                                                                                     | Render                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| App            | `apps/web`                                                                                                                 | `apps/realtime`                                                                                       |
| Root directory | `apps/web`, with "include source files outside root directory" on                                                          | repo root                                                                                             |
| Build          | `npm run build -w apps/web` (runs `prisma generate` first)                                                                 | `npm install && npm run build -w apps/realtime`                                                       |
| Start          | managed                                                                                                                    | `npm run start -w apps/realtime`                                                                      |
| Health         | `/api/health`                                                                                                              | `/health`                                                                                             |
| Does           | pages, auth, REST, email (Nodemailer), LiveKit token minting and moderation calls, LiveKit webhooks, uploads signing, cron | sockets, presence, typing, delivery, notification fan-out, Web Push sending, call ringing, schedulers |

Why the split: Render free blocks outbound SMTP, Vercel free cannot hold WebSockets. Therefore email is only ever sent by the web app. When the realtime service needs an email sent (for example a missed call email), it calls `POST {WEB}/api/internal/email/send` with the internal service token.

Render free sleeps. A free external pinger (UptimeRobot or cron-job.org) hits `/health` every 5 minutes and `/api/health` on web. Clients reconnect with backoff regardless, because Render also restarts. Never design a flow that breaks if the realtime service is cold: joining a call or Room must work using Vercel and LiveKit alone.

Prisma migrations never run in either build. Run `npm run db:migrate` from the owner machine or CI.

### 5.2 Environment variables

Validate with Zod at boot in both apps (`SKIP_ENV_VALIDATION` allowed in CI builds only). Provide `.env.example` with every key, grouped and commented.

Web (Vercel): `APP_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_REALTIME_URL`, `REALTIME_URL`, `DATABASE_URL` (pooled, `pgbouncer=true`, `connection_limit=1`), `DIRECT_URL`, `DATABASE_SCHEMA`, `SESSION_SECRET`, `REALTIME_PASS_SECRET`, `INTERNAL_SERVICE_TOKEN`, `CRON_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_MODE` (`real` or `mock`, mock refused in production), `SMTP_USER`, `SMTP_APP_PASSWORD`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `MAIL_TRANSPORT` (`console`, `capture`, `smtp`), `MAIL_ENABLE_REAL`, `MAIL_ALLOWED_DOMAINS` (default `example.com`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_MEDIA_BUCKET`, `SUPABASE_PUBLIC_BUCKET`, `LIVEKIT_URL`, `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_SITE_NAME`, `PRODUCTION_DB_HOST`.

Realtime (Render): `PORT`, `DATABASE_URL` (session or direct connection, higher limit), `DATABASE_SCHEMA`, `REALTIME_PASS_SECRET`, `INTERNAL_SERVICE_TOKEN`, `WEB_APP_URL`, `ALLOWED_ORIGINS`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:` address), `LOG_LEVEL`.

LiveKit API secrets live on web only. Realtime never talks to LiveKit.

### 5.3 Database and isolation (decision D2)

- One Supabase project to start. Separate Postgres schemas by purpose: `gistroom_dev` (what `npm run dev` uses), `gistroom_test` (integration and browser tests). Production later gets its own project and `public` schema. Selected through `DATABASE_SCHEMA`, appended to the connection string as `?schema=`.
- `scripts/assert-safe-db.mjs` wraps every destructive Prisma command (`migrate reset`, `db push`, seed, test truncation). It refuses to run unless the schema is `gistroom_dev` or `gistroom_test` and the host is not `PRODUCTION_DB_HOST`.
- Integration and browser tests create data with an `e2e_` or `test_` prefix, clean up after themselves, and truncate only the test schema.
- Extensions to enable in migrations: `citext`, `pg_trgm`.
- Cursor pagination everywhere (no offset). Every list query has a supporting index.

---

## 6. Architecture and auth

### 6.1 Responsibilities

- **Postgres is the source of truth.** Socket events are hints that tell clients something changed. After any reconnect, clients refetch what they missed by cursor.
- **Web (Vercel)** owns: auth, sessions, all REST APIs, authorization decisions, LiveKit tokens, LiveKit webhooks, moderation actions through the LiveKit server API, signed upload and download URLs, email.
- **Realtime (Render)** owns: socket connections, presence, typing, delivery and read receipts fan-out, notification fan-out, Web Push sending, call ring timeouts, scheduled reminders.
- Web tells realtime about things to broadcast by calling `POST {REALTIME}/internal/events` with `INTERNAL_SERVICE_TOKEN`. Realtime tells web to send email by calling `POST {WEB}/api/internal/email/send`. Both validate payloads with the shared Zod schemas.

### 6.2 Sessions

- Opaque random session token, stored hashed in the `Session` table, set by the server as an `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/` cookie named `gr_session` with an explicit `Max-Age` of 30 days and a matching `Expires`. No short lived access token. Every cookie (session, `gr_device`, `gr_authed`, consent) is a server `Set-Cookie`, never written from JavaScript (Safari caps script cookies at 7 days).
- Sliding idle expiry of 30 days, written at most once a day per session, with an absolute cap of 90 days from sign in (`LIMITS.SESSION_MAX_DAYS`). The proxy re-issues the same cookie value with a fresh lifetime on page loads, so the cookie slides with the database and a token never rotates (parallel requests and deploys cannot invalidate it). Sessions record user agent, device label, `deviceId`, `lastSeenAt` and `authenticatedAt`.
- Every session end writes a reason (`EXPIRED`, `REVOKED_BY_USER`, `REVOKED_ALL`, `ACCOUNT_DELETED`, `SWEPT`, `INVALID_COOKIE`, `ERROR`) to `Session.endReason` and the pino log. `npm run sessions:ends` prints the last 50. The daily sweep deletes only sessions that expired more than 7 days ago.
- Sensitive actions (export, set a password without one, and the others that already ask for the password) need a sign in from the last 15 minutes. Older than that, the person types the password again (`/api/auth/reauth`).
- The realtime socket never signs anyone out by itself: a failed pass fetch or an `unauthorized` answer is checked against `/api/auth/session` first, and only a real "no session" leaves for the sign in page.
- The installed PWA on iPhone keeps its own cookies, separate from Safari: sign in once inside the installed app.
- Settings shows active devices with "sign out this device" and "sign out everywhere else".
- CSRF: `SameSite=Lax` plus an `Origin` header check on every mutating route.

### 6.3 Realtime pass

- The browser calls `GET /api/realtime/pass` (cookie auth) and receives a JWT signed with `REALTIME_PASS_SECRET`, 15 minute life, containing `userId` and `sessionId`.
- It connects with `io(REALTIME_URL, { auth: { token } })`. Cookies are never used across the two domains.
- Before expiry (or on an `auth_expired` error) the client fetches a fresh pass and reconnects. The server re-checks that the session is not revoked every 5 minutes and before sensitive events.

### 6.4 Sign up, sign in and codes

- **Sign up:** email, one 6 digit code, a password step, then onboarding (name and username), then the app. A half finished sign up continues from the sign in form with a fresh code. **Sign in:** email, then password, in two steps. No code on any sign in. **Forgot password:** a code plus a new password, which signs every other device out. Google people can add a password later in Settings.
- Wrong email and wrong password give the same answer in about the same time. Login attempts are rate limited per email and per address.
- Codes: 6 digits, HMAC-hashed with a pepper, expires in 10 minutes, 60 second resend cooldown, 5 sends per hour per email, 5 verify attempts then a 15 minute lock.
- Owner decision D38 (2026-10-11): the forms say plainly whether an email has an account. Sign up with a finished email says "already has an account, sign in", forgot password and sign in with an unknown email say there is no account. Rate limits still apply to every one of these checks.
- Confirming the code creates an unfinished account and a session. Onboarding collects: name, password (not for Google sign ups), unique username (`^[a-z0-9_]{3,20}$`, reserved words blocked, live availability check with its own rate limit), optional avatar, confirmation that the person is 18 or older, consent to Terms and Privacy (validated by Zod, not HTML).

### 6.5 Google OAuth (from day one)

- Authorization code flow with PKCE, `state` and `nonce`, ID token verified server side.
- If a verified Google email matches an existing OTP account, link them. Both emails are verified, so it is safe.
- `GOOGLE_MODE=mock` exists for dev and tests only and is refused when `NODE_ENV=production`.
- Redirect URIs: `https://gistroom.ng/api/auth/google/callback` and `http://localhost:3000/api/auth/google/callback`.

---

## 7. Data model (Prisma)

Author `packages/db/prisma/schema.prisma` in Phase 0 and Phase 1 following this model. IDs are `cuid2` strings. Timestamps are UTC. Add `createdAt` and `updatedAt` everywhere. Enums in `UPPER_SNAKE`.

Identity

- `User`: `email` (citext, unique), `emailVerifiedAt`, `name`, `username` (unique, lowercase), `avatarPath`, `bio`, `timezone`, `status` (ACTIVE, SUSPENDED, DELETED), `role` (USER, ADMIN), privacy flags `discoverable`, `showPresence`, `sendReadReceipts`, `roomInvitesFrom` (FRIENDS, EVERYONE), `dataSaver` bool, `deletedAt`.
- `AuthAccount`: `provider` (GOOGLE), `providerAccountId`, unique on both.
- `Session`: `tokenHash`, `userId`, `userAgent`, `deviceLabel`, `lastSeenAt`, `expiresAt`, `revokedAt`.
- `OtpChallenge`: `emailHash`, `codeHash`, `purpose`, `attempts`, `lastSentAt`, `expiresAt`, `consumedAt`, `lockedUntil`.

Social

- `FriendRequest`: `requesterId`, `addresseeId`, `status` (PENDING, ACCEPTED, REJECTED, CANCELLED), `respondedAt`, `retryAfter`. Partial unique index so only one PENDING per ordered pair.
- `Friendship`: `userLowId`, `userHighId` (canonical ordering, unique pair).
- `Block`: `blockerId`, `blockedId`, unique pair. A block ends the friendship, hides both users from each other's search, and prevents requests, DMs, calls and Room invites.

Chat

- `Conversation`: `type` (DM), `dmKey` (unique, `lowId:highId`), `lastMessageAt`.
- `ConversationMember`: `conversationId`, `userId`, `archivedAt`, `clearedAt` (delete for me), `lastReadMessageId`, `lastDeliveredMessageId`, `mutedUntil`.
- `Message`: `conversationId`, `senderId`, `clientId` (unique with `senderId`, the idempotency key), `type` (TEXT, IMAGE, VIDEO, VOICE, FILE, ROOM_INVITE, SYSTEM), `body`, `replyToId`, `meta` json, `deletedForEveryoneAt`.
- `MessageAttachment`: `messageId`, `storagePath`, `thumbPath`, `mime`, `sizeBytes`, `width`, `height`, `durationMs`, `waveform` (small int array).
- `MessageStar`: `userId`, `messageId`, unique pair.
- `MessageReaction`: `userId`, `messageId`, `emoji`, unique triple.
- `MessageHidden`: `userId`, `messageId` (delete for me on a single message).
- `FileAsset`: `ownerId`, `bucket`, `path`, `mime`, `sizeBytes`, `status` (PENDING, ATTACHED), used by the daily sweep to remove orphans.

Notifications

- `Notification`: `userId`, `type`, `payload` json, `dedupeKey` (unique per user, nullable), `readAt`.
- `NotificationPreference`: one row per user, per-type switches for in-app, push and email, `previews` bool, quiet hours.
- `PushSubscription`: `userId`, `endpoint` (unique), `p256dh`, `auth`, `userAgent`, `lastSuccessAt`, `failureCount`, `revokedAt`.
- `ScheduledJob`: `kind`, `dueAt`, `payload`, `processedAt`. Idempotent catch-up queue for reminders and ring timeouts (Section 10.5).

Calls and Rooms

- `Call`: `kind` (DIRECT), `callerId`, `calleeId`, `initialMedia` (AUDIO, VIDEO), `status` (RINGING, ACTIVE, ENDED, MISSED, DECLINED, CANCELLED, BUSY, FAILED), `livekitRoom`, `ringExpiresAt`, `answeredAt`, `endedAt`, `endReason`.
- `Room`: `slug` (unguessable, public identifier), `hostId`, `title`, `topicId`, `language` (ENGLISH, PIDGIN, YORUBA, IGBO, HAUSA, OTHER), `description`, `visibility` (PUBLIC, PRIVATE), `status` (SCHEDULED, LIVE, ENDED), `scheduledFor`, `startedAt`, `endedAt`, `locked` bool, `maxParticipants` (default 32), `livekitRoom`.
- `RoomMember`: `roomId`, `userId`, `role` (HOST, MODERATOR, MEMBER), `state` (INVITED, JOINED, LEFT, REMOVED, BANNED), `invitedById`, `joinedAt`, `leftAt`, `graceUntil`.
- `RoomInviteLink`: `roomId`, `tokenHash`, `token` (kept so active links show in full to people who may share them), `createdById`, `expiresAt`, `maxUses`, `usedCount`, `revokedAt`.
- `RoomModLog`: `roomId`, `actorId`, `action` (MUTE, MUTE_ALL, REMOVE, BAN, LOCK, UNLOCK, PROMOTE, DEMOTE, INVITE, LINK_CREATED, LINK_REVOKED, MESSAGE_DELETED, END), `targetId`, `meta`.
- `RoomMessage`: ephemeral room chat, `roomId`, `senderId`, `clientId`, `body`. Deleted when the Room ends. The Room keeps `messageCount`, `reactionCount` and `peakParticipants` for the summary. `RoomReaction` holds reactions on chat messages.
- `Topic`: `slug`, `name`, `description` (drives topic pages and the discover filter).
- `CallLogEntry`: denormalized per user for the Call logs tab: `userId`, `kind` (DIRECT, ROOM), `direction` (INCOMING, OUTGOING, NONE), `outcome` (ANSWERED, MISSED, DECLINED, CANCELLED, BUSY), `mediaType` (AUDIO, VIDEO, MIXED), `peerUserId`, `roomId`, `titleSnapshot`, `searchText`, `startedAt`, `durationSec`. Index `(userId, startedAt desc, id)` and a trigram index on `searchText`.

Safety and ops

- `Report`: `reporterId`, `targetType` (USER, MESSAGE, ROOM, ROOM_MESSAGE), `targetId`, `reason`, `details`, `evidence` json (snapshot of recent messages), `status`, `resolvedById`, `resolution`.
- `AuditLog`: admin and security-relevant actions.
- `RateLimit`: key, window start, count (database-backed limiter for the Vercel side).
- `EmailOutbox`: failed non-sensitive emails retried by the daily job.

Account deletion (decision D5): confirm by email OTP, mark `DELETED`, delete avatar and media files, anonymize the person to "Deleted user" in other people's chats and call logs, keep reports. Offer a PDF data report before deletion.

---

## 8. Realtime contract

All event names and payload schemas live in `packages/shared/src/events.ts` as Zod schemas, imported by both sides. Server to client unless marked.

| Event                                                                      | Purpose                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `presence:update`                                                          | friend online or offline, last seen (respects privacy flags) |
| `typing:start`, `typing:stop` (both ways)                                  | typing indicator in a conversation                           |
| `message:new`                                                              | new message in a conversation the user belongs to            |
| `message:ack` (client to server)                                           | delivered or read cursor                                     |
| `message:delivered`, `message:read`                                        | receipts to the sender                                       |
| `message:updated`                                                          | star, reaction, delete for everyone, edit                    |
| `friend:request`, `friend:accepted`                                        | social graph changes                                         |
| `notification:new`, `badge:update`                                         | in-app notice and unread totals                              |
| `call:incoming`, `call:cancelled`, `call:answered_elsewhere`, `call:ended` | 1:1 call signaling                                           |
| `room:invite`, `room:started`, `room:ended`                                | Room lifecycle                                               |
| `room:member_updated`                                                      | role or state change (moderator promoted, removed, banned)   |
| `room:chat:new`, `room:chat:deleted`                                       | ephemeral Room chat message, live delete                     |
| `room:settings`, `room:locked`                                             | Room settings or lock changed, clients refetch               |
| `room:reaction`                                                            | a floating reaction, throttled per person                    |
| `room:muted`                                                               | a moderator muted your audio or video, or muted everyone     |
| `session:revoked`                                                          | force sign out of this socket                                |

Rules:

- Every event handler checks that the pass user may act on that conversation, call or Room (R16).
- Per-socket token bucket: 30 events per second burst, lower for typing (5 per second). Over the limit means drop and warn, repeated abuse means disconnect.
- Enable Socket.IO connection state recovery for short drops. Do not rely on it: the REST resync by cursor is the guarantee.
- Heartbeat: `pingInterval` 20 seconds, `pingTimeout` 20 seconds. Presence is derived from live sockets; `lastSeenAt` is written on disconnect and at most once a minute.
- Single instance for now (in-memory presence). Note in `wiki/Realtime.md` that scaling out needs the Redis adapter.
- Transports: websocket first, polling fallback.

---

## 9. Features and acceptance criteria

### 9.1 Search and profiles

- Search is by name and username only. No email search, no phone search, ever.
- Minimum 2 characters, trigram match, 30 per minute rate limit, results exclude blocked, deleted, suspended and non-discoverable users.
- Each result shows avatar, name, `@username`, mutual friend count and the correct action: Add friend, Request sent, Message, or nothing when unavailable.
- Profile page `/app/u/[username]`: avatar, name, bio, mutual friends, actions (message, call, block, report).

### 9.2 Friends

- Send, cancel, accept, reject, unfriend, block.
- Rejected request: the sender cannot send again to that person for 7 days (`retryAfter`). The sender is never told "rejected". They see "You can't send a request to this person right now."
- Both people send each other a request at the same moment: auto-accept.
- Limits: 10 requests per hour, 30 per day per user.
- Tabs: Friends, Requests, Sent, Find people. Friend list shows presence per privacy settings.
- DMs, calls and Room invites require an accepted friendship and no block in either direction.

### 9.3 Chats

- Conversation list: avatar, name, last message preview, time, unread count, pinned star indicator count, typing state. Archived chats sit behind an "Archived" row. Desktop is three panes (list, thread, details with media). Mobile is single pane with a bottom tab bar.
- Thread: message bubbles (mine right and green, theirs left and neutral), timestamp on every message in local time (tooltip with full date), day separators, grouped consecutive bubbles, reply, copy, star, react, delete.
- Receipts with Lucide `Check` and `CheckCheck` (sent, delivered, read). Read receipts obey the privacy setting.
- Composer: text, emoji picker (lazy loaded), attach, voice note. Draft is kept per conversation. Send is optimistic with a client-generated `clientId`; failed sends show a retry affordance.
- Offline: the app shell opens offline with cached chats; outgoing messages queue in IndexedDB and flush in order on reconnect without duplicates (idempotent on `clientId`).
- Delete for me hides a message for the caller only. Delete for everyone is allowed for the sender within 15 minutes (D4), and editing a text message is allowed for the same 15 minutes (the bubble shows Edited) and replaces the bubble with "This message was deleted". Delete chat means clear for me (`clearedAt`) and remove from my list; new messages bring it back with only new history.
- Archive: archived chats stay archived when new messages arrive (D3), but the Archived row shows a dot. Unarchive manually.
- Starred messages: per user, a screen listing them with jump-to-message.
- Media tab in chat details: Media (images and videos in a grid with a lightbox), Files, Voice notes, Starred. Cursor paginated.
- Voice notes: `MediaRecorder` with mime negotiation (`audio/webm;codecs=opus` first, `audio/mp4` for Safari). Max 5 minutes. Hold or lock to record, slide to cancel. Waveform of 64 bars generated client side and stored. Playback speeds 1x, 1.5x, 2x. A permission primer modal explains the mic request before the browser prompt.
- Uploads: client requests a signed upload URL (type, size and quota checked), uploads straight to the private bucket at `dm/{conversationId}/{messageId}/{uuid}`, then the server finalizes after verifying magic bytes and size. Images are compressed client side (target 1.5 MB, longest edge 2048 px) with orientation applied and EXIF removed by re-encoding; thumbnails are generated client side. HEIC is converted to JPEG client side. Videos up to the limit in Section 26 with a client-generated poster frame. Allowed files: pdf, docx, xlsx, pptx, txt, csv.
- Downloads go through `/api/media/[id]` which authorizes membership and redirects to a 5 minute signed URL.
- Reports on any message capture the last 20 messages as evidence.

### 9.3b Presence and privacy

- Presence and last seen shown only to friends and only if `showPresence` is on (and the viewer's own setting is on, as in most messengers).

### 9.4 Calls (1:1)

- Start from a chat or profile: audio or video. Callee rings in-app (if a socket is live) and by push (always).
- Flow: `POST /api/calls` validates friendship, block and callee availability, creates the `Call` as RINGING with `ringExpiresAt` = now + 45 seconds, notifies realtime, and returns a LiveKit token so the caller connects immediately. Accept returns the callee token. Decline, cancel and timeout set the status and write `CallLogEntry` rows for both people.
- Ring timeout is enforced by the realtime scheduler and by the catch-up sweeper (Section 10.5), because Render can restart.
- Glare: if A calls B while B is calling A, merge into one call and accept it.
- Busy: callee already in an ACTIVE call gets a "missed call" entry and the caller sees "On another call".
- Multi-device: answering on one device sends `call:answered_elsewhere` and a cancel push to the others.
- Switching media: audio to video and back mid-call by toggling the camera track on the same LiveKit room (`setCameraEnabled`). No reconnect. Both sides see the tile appear and disappear with a short animation. If camera permission is denied, show a modal that explains how to enable it and stay in audio.
- Quality: adaptive stream, dynacast and simulcast on. Data saver mode starts calls audio-only and caps video at 360p. If connection quality stays poor for 10 seconds, offer "Switch to audio only" in an inline banner.
- Controls: mute (`M`), camera (`V`), flip camera (mobile), speaker, microphone and camera picker, mirror, reactions, end. The answer step has mute and camera toggles.
- Keep screen awake during calls (Screen Wake Lock API where supported).
- **The call lives in the tab, in a floating window.** Starting a call from a chat, a profile or the call log opens the call window and leaves the page as it was.
- **The call lives in the tab, not the screen.** One live session (`lib/live/live-session.ts`) holds the LiveKit connection, so opening chats or settings never drops a call. An in call bar shows the timer, mute, a way back and hang up. Leaving always runs one cleanup: every track stopped, the room disconnected, timers and listeners removed, the wake lock released. The tab title reads "In call 05:12 | Gistroom". A tab sends a heartbeat every 8 seconds, and a side silent for 60 seconds ends the call (`peer-gone`). A block or an unfriend ends the call with the neutral line "This call has ended".
- **Outcomes are dialogs, never silent.** The caller hears "declined", "is busy" (another call or a room), "didn't pick up" or "may not see this right away". The other person leaving shows "{name} left the call" with the length. A reload offers "Rejoin your call".

### 9.5 Call logs tab

- `/app/calls`: list of `CallLogEntry` for the user. Filters: All, Audio, Video; Direct or Room; outcome (Missed, Answered, Declined). Search by person name or Room title. Cursor pagination with Previous and Next, page size selector (10, 20, 50), total count.
- Each row: avatar or Room mark, name, direction icon, media icon, outcome, duration, time. Row actions: call back, message, view Room details.
- Logs persist after a Room disbands.

### 9.6 Rooms (group calls)

- A Room is created on the fly ("Start a room") or scheduled. Fields: title (80 chars), topic, language tag (English, Pidgin, Yoruba, Igbo, Hausa, Other), visibility, optional description, optional schedule.
- Capacity: 32 participants (Section 26). When full, show "This room is full".
- **Public Room:** any signed-in person can join from discover or a link. Signed-out visitors see the public Room page and a sign-in prompt.
- **Private Room:** only invited people can enter. Invited means a `RoomMember` row in INVITED or JOINED state. Anyone else who opens the URL sees the "not invited" screen with no title, host or member leak. A valid, unexpired invite link adds the opener to the invite list when they open it signed in (D6). Expired or revoked links show the same "not invited" screen.
- Roles: HOST, MODERATOR, MEMBER. Moderators can mute, mute all, remove, ban from the Room, lock the Room, delete Room chat messages, copy and forward the Room link, and invite other moderators. Only the host can demote a moderator, transfer host and end the Room for everyone.
- **Copy and forward link:** moderators and the host can copy the link or forward it to recent chats, or enter a name and search people (name search rules from 9.1). Forwarding a private Room link to a friend also invites them. A forwarded link arrives in the DM as a Room invite card.
- Invite links expire. Default 24 hours, options 1 hour, 12 hours, 1 day, 7 days, optional max uses. Active links show in full with Copy, uses and expiry in 12 hour time. Revoke works at once. Members of a public room share the plain room link unless the host turns that off. Only the host and moderators make expiring links.
- Host leaves: host transfers to the longest-serving moderator, else the longest-present member. If the Room empties it ends after 60 seconds.
- Rejoin grace: if you drop, you can reclaim your seat and role for 120 seconds.
- Room end: LiveKit room closed, status ENDED, group dissolves, `CallLogEntry` written per participant, Room chat deleted at once (reports keep their own evidence snapshot). The Room stays as a record: attendees see a summary (duration, peak, people, messages, reactions, who came, their own notes), the host also sees the moderator action count, everyone else sees "This room has ended". Past rooms lists every Room you hosted or attended.
- Room chat: ephemeral text with emoji, avatars and role badges, rate limited, senders delete their own and moderators delete any, chat mode (everyone, moderators, off), slow mode, reactions. Floating reactions use the ten fixed reactions in `packages/shared/src/reactions.ts`.
- **Registering for a scheduled room:** a person puts their name down (private rooms: only invited people, and never someone the host blocked). The second tap changes nothing. They get an Activity line and an email with the time in their own zone (12 hour) and an Add to calendar link with an .ics attached. The host gets one aggregated line per room ("Ada and 4 others registered", no push, no email). 15 minutes before: in app, push and email "{title} starts in 15 minutes" (not for anyone who registered with under 15 minutes left, and nothing if it is more than 10 minutes late). When the host starts it: "{title} is live now" for registrants who are not already inside, never at the scheduled time alone. At the scheduled time with no start: the host gets "Your room is due to start now." After 30 minutes (`ROOM_SCHEDULE_GRACE_MIN`) the room is cancelled and registrants are told. A new time or a cancellation by the host tells registrants and moves or removes the reminders. Quiet hours hold back push only. Every notice has a `room:{id}:...:{userId}` dedupe key, and the sweep reads the rooms, so a lost job loses nothing.
- Room settings (host and moderators, live, logged): name, description, topic, language, visibility, cameras allowed, join muted, chat mode, reactions, slow mode, members can share the link, only moderators can unmute, lock. Moderators can also turn off one person's video.
- Same person in two tabs or devices: one seat. The newer connection replaces the older, with a modal on the older.
- **Before joining:** a check screen with a microphone level, a camera preview, device pickers and "Join muted" and "Join with camera off" (remembered). A browser built into another app is told to open the link in the real browser first.
- **Chips, not noise:** "{name} joined", "{name} left", "{name} reconnected", "5 people joined" for a burst, never your own name, a leave only after a 10 second reconnect window, and only counts above 24 people. A setting turns the notices off. Join and leave tones play in rooms of 12 people or fewer.
- **People panel:** count, role badges, mic and camera state, signal bars and when each person joined. People who were invited and are not inside show Invited, Ringing, Declined or No answer, with a Ring button (one ring per person per 30 seconds, three per room per 10 minutes, quiet hours respected, "Don't ring me for this room").
- **Remove or ban:** a removed person waits 10 minutes (`ROOM_REMOVE_COOLDOWN_MIN`) on every way in, links included, and private rooms need a new invite. A ban never ends. Their chat comes off the screen.
- **The end:** the person who ends it reads "You ended the room". Everyone else reads who ended it (the host or a moderator) with the length and peak, and attendees can open the summary. A room with nobody connected for 5 minutes is ended by the sweeper, which asks LiveKit who is connected. A room ends after 8 hours with a warning 15 minutes before. A scheduled room whose host never came is cancelled after 30 minutes and its list is told.
- **Large rooms:** 16 people per page of the stage, the people speaking first, and video is only subscribed for the tiles on screen.
- Moderator action log: every moderator action is written to `RoomModLog` and shown to the host in a panel inside the Room.
- Discover (`/rooms` public, `/app/rooms` authed): live public Rooms sorted by activity, scheduled Rooms, filters for topic and language, search by title. Public page revalidates every 30 seconds.
- Optional later (flagged, not Phase 5 core): Stage mode with raise hand, where only invited speakers hold the mic.
- Video layout: adaptive grid, active speaker highlight with a green ring, pin, and only visible tiles subscribe to video.

### 9.7 Notifications (summary, details in Section 10)

In-app list with unread filter, read, unread, delete, clear all. Bell with count. App icon badge through the Badge API. Preferences per type. Do Not Disturb.

### 9.8 Safety and admin

- Block and report from profile, chat, call screen and Room tile.
- `/app/admin` (ADMIN role only, hidden from everyone else): report queue with evidence, user lookup, suspend and ban, live Rooms view, audit log, metrics charts (Recharts): signups, DAU, Rooms started, call minutes, reports.
- Terms, Privacy and Acceptable Use are real pages. Mention the Nigeria Data Protection Act and the Cybercrimes Act in the legal copy and have the owner review it. Provide a takedown contact (`safety@gistroom.ng`) on the Safety page.

### 9.9 Settings

Profile, Privacy (discoverable, presence, read receipts, who can invite me to Rooms), Notifications (per type, previews, quiet hours, test notification button), Devices (sessions), Data saver, Install app, Export my data (a PDF report, with a notice in the list when it is downloaded), Delete account.

---

## 10. Notifications and push (the reliable part)

The scenario that must work: someone signs in on a browser one night, never reopens that tab, and a friend calls the next morning. The phone or laptop must still alert them. Sockets cannot do this. Web Push can.

### 10.1 Delivery decision

For every notifiable event the realtime service:

1. Writes the `Notification` row (with `dedupeKey` for one-time events).
2. If the user has a live, focused socket: emit `notification:new` and skip push (except calls, which always push).
3. Otherwise: send Web Push to every non-revoked subscription of that user.
4. If a call or important item stays unseen, optionally trigger a throttled email through the web internal endpoint (one missed-call email per caller per hour at most).

### 10.2 Push payload and options

Payload is a small JSON (under 4 KB): `{ type, title, body, url, tag, data }`. Respect `previews` (when off, body is generic: "New message").

| Type                     | TTL        | Urgency | requireInteraction | tag                               |
| ------------------------ | ---------- | ------- | ------------------ | --------------------------------- |
| CALL_INCOMING            | 45 seconds | high    | true               | `call:{callId}`                   |
| CALL_CANCEL (to dismiss) | 45 seconds | high    | n/a                | `call:{callId}`                   |
| DM_MESSAGE               | 24 hours   | normal  | false              | `dm:{conversationId}` (collapses) |
| FRIEND_REQUEST           | 7 days     | normal  | false              | `fr:{requestId}`                  |
| ROOM_INVITE              | 1 hour     | normal  | false              | `room:{roomId}`                   |
| ROOM_STARTING            | 15 minutes | high    | false              | `roomstart:{roomId}`              |
| SECURITY_NEW_DEVICE      | 24 hours   | high    | false              | `sec:{sessionId}`                 |

A short TTL on calls stops a ring arriving twenty minutes late. After TTL the call is a missed call entry.

### 10.3 Service worker behavior (`sw.ts`)

- `push`: parse payload. If any window client is visible and focused and the type is not a call, do not show a system notification. Always show something for every push (Chrome requires it). For `CALL_CANCEL`, close the matching notification then show a quiet "Missed call from {name}" notification with the same tag.
- Call notification: title "{name} is calling", body "Audio call" or "Video call", `requireInteraction: true`, actions Answer and Decline, vibrate pattern, app icon and monochrome badge.
- `notificationclick`: Answer or body click focuses an existing client and navigates it to `/app/call/{id}?answer=1`, else opens a window. Decline calls `POST /api/calls/{id}/decline` with credentials from the worker, then closes the notification.
- `pushsubscriptionchange`: resubscribe and update the server.
- Update the Badge API from the unread count in the payload.

### 10.3b Push is independent of the session

Web Push depends on the browser's push subscription and the notification permission, never on our login cookie. A `PushSubscription` belongs to a person and a device (`deviceId` from the 1 year `gr_device` cookie), not to a session. Session expiry, revocation or rotation never touches it.

- A subscription is removed only when: the person signs out on that device on purpose (the client unsubscribes and the server deletes it), signs out everywhere else (the other devices' subscriptions go, the current device keeps its own), the account is deleted, the push service answers 404 or 410, the person turns alerts off or removes the device in Settings, or there has been no successful delivery for 90 days.
- `endpoint` is unique. If another person signs in on a browser that already has a subscription, the row moves to them on subscribe or on the next app load.
- Grace period: after a device's session ends it keeps getting alerts for 30 days (`LIMITS.PUSH_GRACE_DAYS`) with plain text only ("You have a new message", "You have a missed call", "You have a room invite"), and calls as "Incoming call. Open Gistroom to sign in and answer.". After 30 days the device is marked `needsReauth` and skipped. Signing in again on that device relinks it.
- Tapping a notification with an expired session goes to `/login?next=<deep link>` and returns to the same place after sign in. Answer and Decline that get a 401 open the call link and the sign in.
- On every signed in load the client resubscribes silently if permission is granted and the subscription is missing, and updates the server if the endpoint changed. Three failures in a row mark the device unhealthy and the person is told once. A browser that blocked alerts gets a modal with steps.
- Settings, Notifications shows this device's permission, subscription, install state and last delivery, a test button that really pushes to this device, the list of devices with remove, and the real reasons alerts stop.
- Platform limits, stated plainly: macOS Chrome and Edge deliver only while the browser runs. Windows Chrome needs "continue running background apps". iPhone needs the app on the Home Screen. Some Android phones (Tecno, Infinix, Itel, Xiaomi) kill background apps. Firefox desktop needs to be running.

### 10.4 Subscription lifecycle

- Register the service worker on first authed load. Subscribe only after the user opts in.
- Opt-in flow: never prompt on first visit. Show a primer modal at a value moment (after the first accepted friend, first DM, or from Settings), then call `Notification.requestPermission()`.
- One row per endpoint. On HTTP 404 or 410 from the push service, mark revoked. Record `lastSuccessAt` and `failureCount`; revoke after repeated failures.
- iOS: push only works for the installed PWA (iOS 16.4 or newer). The Install page and a contextual modal explain "Add to Home Screen" with illustrated steps. Android and desktop work in the browser.
- Android phones with aggressive battery managers can delay push. Document this in the Support FAQ and always keep the missed-call log and the optional email fallback.

### 10.4b Connection states (calls, rooms and chat)

One `ConnectionMonitor` (`useConnection()`) checks our own server every 10 seconds while the app is visible and every 30 seconds hidden, so a captive portal or Wi-Fi with no data counts as offline. A change holds for 3 seconds before anything reacts and recovery for 2. Offline shows a bar ("You're offline. Messages will send when you're back."), then "Back online" for 3 seconds. Weak signal is a banner, never a dialog, unless `NETWORK_WEAK_AS_MODAL` is set. Only the realtime service being down is a quiet note ("Connecting to chat..."), because chat works over plain requests. Call and room dialogs go through one `SessionModalHost`: one at a time, most urgent first (removed, ended, disconnected, blocked, offline, info), `role="alertdialog"`, always a way out, closing by themselves when the cause clears with a "You're back" chip. The LiveKit webhook (`/api/livekit/webhook`) is verified, de-duplicated by event id, and only ever asks for a reconcile of that room, so out of order events cannot leave a room stuck. See `wiki/Network-States.md`.

### 10.5 Reliability when the realtime service sleeps or restarts

- `ScheduledJob` rows (ring timeouts, Room reminders) are written by web. The realtime scheduler polls every 30 seconds for `dueAt <= now() AND processedAt IS NULL` and processes idempotently. On boot it runs the same query immediately, so nothing is lost across a sleep.
- Vercel cron (daily on the free plan) runs `/api/internal/jobs/sweep` as a second safety net, plus cleanup: orphan uploads older than 24 hours, expired OTPs and sessions, expired Room chat, old rate limit rows, old notifications.
- Clients reconnect with exponential backoff and jitter, and on `visibilitychange` and `online` events resync unread counts, missed calls and missed messages by cursor.

### 10.6 In-app notification types

FRIEND_REQUEST_RECEIVED, FRIEND_REQUEST_ACCEPTED, DM_MESSAGE (aggregated per conversation, one row, count updates), CALL_MISSED, ROOM_INVITE, ROOM_STARTING (the 15 minute reminder), ROOM_LIVE_NOW, ROOM_DUE_HOST, ROOM_RESCHEDULED, ROOM_CANCELLED, ROOM_REGISTRATIONS (the host's one row per room, in the app only), ROOM_ROLE_CHANGED (also removed and banned), ROOM_ENDED, SECURITY_NEW_DEVICE, REPORT_UPDATE, SYSTEM, and ACTIVITY (a receipt for what the person did, created already read, in the Activity tab only, never pushed or emailed, expires after 7 days). Notices never block the action that caused them, links stay inside the app, one-time events use `dedupeKey`.

---

## 11. PWA

- `manifest.ts`: `name` Gistroom, `short_name` Gistroom, `start_url` `/app/chats`, `scope` `/`, `display` `standalone`, `background_color` and `theme_color` from tokens, icons 192 and 512 (purpose `any`) plus a 512 `maskable`, `shortcuts` (Start a room, Call logs), `categories` social.
- Service worker via Serwist: precache the app shell and fonts, runtime cache for static assets, `NetworkFirst` for API reads with a short timeout, never cache authenticated API responses beyond a short stale window, never cache media signed URLs, offline fallback page `/offline` with art.
- Offline: shell loads, cached conversation lists and last 50 messages per recent chat are readable, composer queues sends.
- Install: capture `beforeinstallprompt` on Android and desktop and show our own install card (in Settings and after the first meaningful action). On iOS show illustrated Add to Home Screen steps. Never nag: once dismissed, wait 14 days.
- Badge API for unread counts where supported.
- Updates: when a new service worker is waiting, show a modal "New version ready" with a Refresh button (no toast).
- Lighthouse PWA checks must pass.

---

## 12. SEO

Users land on a public page before they ever see the authed app, so the public site must rank and share well. The app shell is private.

### 12.1 Public pages (all server rendered)

`/` landing, `/about`, `/features`, `/security`, `/safety` (community guidelines and reporting), `/support` (contact form, FAQ, troubleshooting incl. push and install), `/install`, `/privacy`, `/terms`, `/cookies`, `/acceptable-use`, `/rooms` (live and scheduled public Rooms), `/topics/[slug]` (one per topic, with a short intro and the live Rooms), `/rooms/[slug]` for public SCHEDULED or LIVE Rooms, `/changelog` (optional, from CHANGELOG.md).

### 12.2 Per page requirements

- `generateMetadata`: unique `title` (under 60 chars, pattern `Page name | Gistroom`, home is the brand line), unique `description` (under 160), canonical URL on `https://gistroom.ng`, Open Graph and Twitter tags, `metadataBase` set, `lang="en-NG"` on `<html>`.
- Exactly one `h1`, logical heading order (no jumping from h1 to h3), descriptive link text, `alt` on every image, written next to the image in the page or in the manifest (decorative art gets `alt=""`).
- Dynamic OG image per page via `opengraph-image.tsx` using `next/og` with Graphik. Satori does not read woff2, so load the Graphik `.ttf` or `.woff` for OG images. 1200 by 630, brand art plus the page title in Graphik Bold.
- JSON-LD: `Organization` and `WebSite` on home, `FAQPage` on `/support`, `BreadcrumbList` on inner pages, `Event` on scheduled public Rooms, `SoftwareApplication` on `/features` or `/install`. Validate in a test that every block parses.
- `sitemap.ts` (static pages, topics, scheduled public Rooms), `robots.ts` (allow public, disallow `/app`, `/api`, `/onboarding`, `/verify`), `noindex, nofollow` meta on every authed page, private Room pages and ended Room pages.
- Redirect `www` to apex. Always HTTPS. Trailing slash policy consistent.
- Ended Room URLs return a 404 page with `noindex` and links to the Rooms index and the Room's topic.
- Performance is SEO: budgets in Section 24.
- Submit the sitemap in Search Console (owner task, listed in the README launch checklist).

### 12.3 SEO tests (part of verify)

For every public route: status 200, one h1, unique title and description, canonical present, OG tags present, JSON-LD valid, no `noindex`. For authed routes: `noindex` present.

---

## 13. Design system

Palette: green and yellow with black, white and grey neutrals. Tokens live in `apps/web/src/lib/tokens.ts` and CSS variables in `globals.css` (Tailwind v4 `@theme`).

| Token                 | Light     | Use                                                         |
| --------------------- | --------- | ----------------------------------------------------------- |
| `green-600` (primary) | `#0E7A43` | primary buttons, links, my bubbles, speaking ring           |
| `green-700`           | `#0A5C32` | hover and pressed                                           |
| `green-100`           | `#E4F4EB` | tinted surfaces, selected rows                              |
| `yellow-400` (accent) | `#FFC20E` | highlights, badges, live dot, key illustration accents      |
| `yellow-100`          | `#FFF4CC` | soft accent surfaces                                        |
| `ink-950`             | `#0B0B0C` | text, dark surfaces                                         |
| `ink-700`             | `#3A3A3F` | secondary text                                              |
| `ink-500`             | `#6B6B72` | muted text                                                  |
| `ink-200`             | `#E3E3E6` | borders                                                     |
| `ink-100`             | `#F1F1F3` | subtle fills, their bubbles                                 |
| `white`               | `#FFFFFF` | surfaces                                                    |
| `danger-600`          | `#C62828` | destructive actions, errors, end call (functional use only) |

Rules:

- Yellow is a fill with `ink-950` text on top. Never yellow text on white, never white text on yellow.
- Green text on white passes AA at `green-600`. Use `green-700` for small text.
- Light mode is the default for everyone (D24). Dark mode is first class and opt in: surfaces `#0F1210` and `#171B18` with green-tinted greys, same accents. The theme control offers Light, Dark and System, and only System follows `prefers-color-scheme`. Define tokens for both modes.
- Radius scale with intent, not one radius everywhere: inputs 10px, buttons full pill, bubbles 18px with a squared tail corner, cards 24px, hero surfaces 32px.
- Shadows: two levels only, tinted with the green or ink, never generic grey stacks.
- Spacing on a 4px grid. Max content width 1200 on marketing pages, line length under 80 characters.
- Brand patterns (adire, Ankara, Uli inspired) are CSS or PNG tiles in the palette, used sparingly as section edges, avatar frames and empty-state backdrops.

Core components (build once, reuse): Button (variants, loading, icon), IconButton, Input, Textarea, Field (label, help, error), OtpInput, Select, Combobox, Modal, Sheet (bottom sheet on mobile), Tooltip, Popover, DropdownMenu, Tabs and SegmentedTabs, Avatar (presence dot, speaking ring), AvatarStack, Badge, Skeleton, EmptyState (takes a PNG id, title, body, action), Pagination, ChatBubble, MessageList (virtualized), Composer, VoiceNotePlayer, MediaGrid and Lightbox, ParticipantTile, RoomStage, CallControls, DevicePickerModal, PermissionPrimerModal, InstallCard, NotificationItem, NotificationBell, ConnectionBanner, ScrollWave, FeedbackProvider.

Scroll to top (D27): there is no floating back to top button. The page is a voice note. A waveform scrubber (`ScrollWave`) shows how far you have played and you drag, tap or use the keys to seek (a horizontal waveform fixed at the bottom centre of the page on desktop, and on phones a speedometer style gauge with a needle around the centre chat button of the dock). The footer wordmark is the replay control and scrolls to the top.

Cookie consent: a small banner that stores consent via `/api/consent` with categories (essential, functional, analytics). Do not load analytics before consent.

Frontend design discipline (apply to every screen):

- Make deliberate choices for this brief. Avoid the templated tells: identical rounded cards everywhere, tracked-out all-caps eyebrow labels above every heading, arrows appended to every button, one word of a headline highlighted in a different color, numbered 01 02 03 markers on content that is not a sequence, gradient washes as decoration, fade-and-slide-up on every section.
- Spend boldness in one place per screen. One memorable element, quiet everything else.
- Motion either answers an action (open, confirm, switch audio to video) or is one orchestrated moment. Never scatter effects.
- Plan tokens and layout first, check the plan against this file, then build, then screenshot and critique at 360, 768 and 1440 widths.

---

## 14. Font: Graphik

The owner supplied Graphik (weights Thin through Super, with italics). Graphik is a commercial typeface. The owner must hold a web license; this is recorded in `wiki/Decisions.md` (D7). If the repository is ever made public, do not commit the font files unless the license allows redistribution.

Setup:

- Copy only what is needed. Web: `woff2` files into `apps/web/src/fonts/graphik/`. OG images and graphics scripts: the matching `ttf` files into `design/fonts/`. Do not ship `eot`, `woff`, `demo.html` or `stylesheet.css`.
- Load with `next/font/local` as the CSS variable `--font-graphik`, `display: "swap"`, with a fallback stack `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif`. Preload only Regular and Semibold.
- Weights in use: Regular 400 (body), Medium 500 (UI labels), Semibold 600 (buttons, names), Bold 700 (headings), Black 900 (hero and display moments), Super used only for the wordmark and the hero headline if it fits the layout. Regular Italic only. Drop everything else from the build.
- Type scale (rem, fluid with `clamp` for display): 0.8125, 0.875, 1, 1.125, 1.25, 1.5, 1.875, 2.5, 3.5, 5. Body line height 1.55, headings 1.05 to 1.2, negative letter spacing on large display sizes, never all caps for labels.
- **Glyph coverage check (do this in Phase 0):** write `scripts/check-font-coverage.mjs` using `fontkit` or `opentype.js` to read the TTF `cmap` and fail if any of these are missing: `₦`, Yoruba and Igbo letters and marks (`ẹ ọ ṣ ị ụ ṅ` and their capitals, combining dot below U+0323, combining grave U+0300, acute U+0301, macron U+0304), Hausa hooked letters (`ɓ ɗ ƙ ƴ` and capitals). For anything missing, the CSS `font-family` falls through to Noto Sans for those characters (add Noto Sans as a self-hosted subset fallback via `unicode-range`). Record the result in `wiki/Design-System.md`. Names typed by users must never render as boxes.
- Tabular numbers (`font-variant-numeric: tabular-nums`) for call timers, counts and times.
- Email clients cannot load Graphik. Emails use the fallback stack.
- Graphics and OG images must use the real Graphik files, never a lookalike (Section 17).

Remember what a font cannot do: the Nigerian spirit comes from the illustration, the pattern work, the colors and the copy voice. Graphik is the clean, confident base that lets those speak.

---

## 15. Landing page (the showcase)

Goal: inviting, alive, fast. Someone should think "I want to use this" before they scroll twice. Use real animation, advanced widgets and custom illustration. Do not reuse the Job Central header or its patterns.

### 15.1 Header: the Voice Dock

- Desktop: a floating capsule centered near the top (not a full-width bar). Left: logo mark. Center: nav (Features, Rooms, Safety, About) where a single highlight blob slides between items with a shared `layoutId` on hover and focus. Right: a "Live now" pill with a pulsing dot and the real count of live public Rooms (fetched from `/api/public/stats`, cached 30 seconds, hidden when zero or on error, never faked), and the primary CTA "Enter Gistroom".
- On scroll down the capsule contracts into a compact circular "mic bubble" holding the mark, with a faint waveform ring that reacts to scroll velocity. Tap or press Enter and it fans out radially into labeled Lucide icon buttons (spring physics). Scroll up and it restores to the capsule.
- Mobile: no top hamburger. A thumb-zone dock at the bottom: four icon items plus a center CTA, "More" opens a draggable bottom sheet. Respect safe area insets.
- Must not be: a full-width bar that shrinks into a pill on scroll (that is the Job Central header).
- Accessibility: `nav` landmark, real buttons, `aria-expanded`, focus trap in the sheet and radial menu, Escape closes, reduced motion shows a static capsule.

### 15.2 Sections (top to bottom)

1. **Hero.** Headline, subhead, two CTAs (Enter Gistroom, See live rooms). Layered PNG illustration (back, mid, front as separate transparent PNGs) with subtle pointer parallax on desktop. Speaking rings pulse on the illustrated people, sound bars animate behind them, and Nigerian chat bubbles drift in and out with short lines of gist. This is the one memorable moment of the page. Keep LCP image under 250 KB.
2. **How it works.** A sticky scroll-linked storyboard (Motion `useScroll`, `useTransform`, `useSpring`) with a device mock that morphs per step. The content is a real sequence, so numbering is allowed here: get your code by email, find your people, start or join a room, keep gisting in chat.
3. **Try a Room (interactive widget).** A mock Room stage visitors can play with: tap an avatar to unmute (speaking ring and wave), raise a hand, switch the view between audio and video with a morph animation, send a reaction burst. Pure client demo, no real media.
4. **Calls that switch.** A phone mock where an audio call becomes video with one tap, animated tile expansion.
5. **Notifications that find you.** An animated device mock where a call, a message and a friend request arrive as push notifications, closing with the promise that you get them even when the tab is closed.
6. **Discover.** Live public Rooms preview from the API, topic chips and language chips that filter with animation. If there are no live Rooms, show clearly labeled sample Rooms.
7. **Chat, properly.** A bento of different-sized tiles (not identical cards): a voice note with a playing waveform, a media grid, a starred message, an archive swipe, bubbles with timestamps.
8. **Safe by design.** Moderators, private Rooms, block and report, with art.
9. **Built for Nigerian data.** Audio first and data saver, shown with a network strength slider that changes the call UI between video and audio-only.
10. **FAQ.** Accordion, also emitted as `FAQPage` JSON-LD.
11. **Final call to action.** Large illustration, a warm welcome line, the Enter Gistroom button.
12. **Footer.** Oversized wordmark with a hover waveform, sitemap columns (Product, Company, Legal, Help), install card, real social links only (hide any that are not configured), "Made in Nigeria" in words, small print, and the scroll-to-top button.

### 15.3 Motion and performance rules

- Motion library only (`motion/react`). Transform and opacity only. Pause animations off screen with `IntersectionObserver`. No layout-shifting animation. No scroll hijacking.
- Reduced motion: every animation resolves to its final state.
- Lazy load below-the-fold widgets with dynamic import. Hero art is the only `priority` image.
- Budgets in Section 24. The landing page must score 90 or higher on Lighthouse performance on mobile emulation, and 100 on SEO and accessibility.
- No fabricated stats, testimonials or logos. If a section needs social proof and there is none, leave it out.

### 15.4 Copy direction

Warm, short, specific. Headline candidates (pick one, keep it readable by every Nigerian): "Come gist. Properly." / "Your people dey here." / "Talk about Naija, out loud." Subhead: "Start a room, call your friends, or drop into a conversation already going on. Audio first, video when you want it, built for Nigerian data and Nigerian opinions." Button text says exactly what happens: "Enter Gistroom", "See live rooms", "Start a room".

---

## 16. App shell and key screens

- Desktop: left rail (Lucide icons with labels): Chats, Rooms, Calls, Friends, Notifications, Settings, plus Admin for admins. Three-pane Chats. Command palette (`Ctrl+K`) for search people, jump to chat, start a room.
- Mobile: bottom tab bar, single pane, safe-area aware, sheets instead of popovers.
- Chats with nothing selected shows the `empty-chat` PNG and one action.
- Live Room screen: stage grid, participant strip, controls bar, side panel (Room chat, People, Moderator log for the host), connection banner, copy and forward link modal.
- Call and room window: a call or room opens in one floating window mounted in the app shell (`components/call-window`), never as a page takeover. Expanded it sits top right below the header, drags by its title bar, resizes from every edge and corner (320 by 240 up to 80 percent of the screen, a call keeps a 16 by 9 picture), snaps to the edges and corners within 24 px, stays inside the screen and remembers its size and place per person on the device. Minimized it is a bar (timer, mute, return, hang up), or on a phone a thin "In call, tap to return" bar at the top, or a draggable video bubble for a video call. Full screen uses the Fullscreen API for the whole page (so dialogs still show) with a CSS fallback on iPhone, Escape leaves it and a double click on the title bar toggles it. It is `role="dialog"` with `aria-modal="false"`, above the page and below every dialog, it never takes focus, and it announces its changes politely. The floating button steps aside while it shows. Closing asks "Leave this call?" or "Leave this room?" when something is live. One call or room at a time: starting or joining another asks "Leave your current call to join this room?" first. `/app/call/{id}` and `/app/rooms/{slug}` still work as links and open the window (a room page behind it shows a quiet details page, and an ended or closed room keeps its own page). The call screen inside it: large avatar or video, controls, timer with tabular numbers, upgrade to video control, quality banner.
- Every list has a loading skeleton, an empty state with art, and an error state with a retry.
- Every destructive action has a confirm modal that names what will happen.

---

## 17. Graphics system

The owner wants clean PNG illustrations, real African illustration (not stock photography), used wherever the product needs warmth: hero, auth pages, landing sections, the empty chat pane, empty states, error pages, OG images.

### 17.1 Formats

- Illustrations: PNG. Keep the full-resolution master in `design/masters/`. Ship optimized copies in `apps/web/public/images/` at 640, 1024, 1600 and (hero only) 2400 pixel widths, quantized or compressed to meet budgets (Section 24). Always render through `next/image` with correct `sizes`. Generate a tiny blur placeholder per image with the build script.
- Logo and wordmark: SVG source in `design/masters/logo/`, exported to PNG sizes by `npm run brand`.
- Pattern tiles: PNG or CSS.
- Icons in the UI: Lucide, not PNG.

### 17.2 Asset manifest

`design/assets.manifest.json` lists every asset: `id`, `placement`, `master`, `sizes`, `alt`, `prompt`, `status` (PLACEHOLDER, DRAFT, APPROVED), `createdAt`. A script (`scripts/graphics/verify.mjs`, part of verify) fails if a referenced image is missing, over budget, lacks alt text or is still a PLACEHOLDER in a release build.

Required assets:

- Hero: `hero-back`, `hero-mid`, `hero-front` (transparent layers, 2400 by 1600 master).
- Auth panels (portrait, 1200 by 1600): `auth-login`, `auth-signup`, `auth-verify`, `auth-onboarding`.
- Landing sections (square or 4:3, 1200 master): `how-1` to `how-4`, `safety`, `nigeria-data`, `final-cta`, `discover-backdrop`.
- Empty and state art (800 square): `empty-chat`, `empty-friends`, `empty-requests`, `empty-calls`, `empty-rooms`, `empty-notifications`, `empty-search`, `empty-archived`, `empty-starred`, `empty-media`, `offline`, `error-500`, `not-found`, `room-ended`, `room-full`, `not-invited`, `install-ios`, `install-android`.
- Brand: logo mark, wordmark, horizontal and stacked lockups, inverted and mono versions, `favicon.ico` (16, 32, 48), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (artwork inside the central 80 percent safe zone), `apple-touch-icon.png` (180), `badge-96.png` (monochrome white on transparent, used as the push badge), `og-default.png` (1200 by 630).

### 17.3 Art direction (the style lock)

Contemporary African editorial illustration. Warm, confident, human. Flat shapes with soft grain and gentle shading, bold simple forms, a consistent light source from the upper left. Palette locked to the brand tokens (greens, yellow, black, white, greys) plus natural skin tones and small warm accents. Characters are Nigerian and varied: different ages, body types, skin tones, hair and head wraps, agbada, ankara, hijab, caps, casual wear. Settings are real gist spaces: a rooftop, a joint under an umbrella, a barbershop, a living room, a campus step, a danfo bus, a football viewing centre, a generator hum and lantern at night. Convey energy through gesture and speaking rings, not caricature.

Never: stock-photo office scenes, poverty or safari tropes, caricature, real people's likeness, trademarks, the national flag or coat of arms as decoration, sacred or ritual symbols (for example Nsibidi or orisha imagery), emoji, or any baked-in text.

Pattern vocabulary (inspired, never copied wholesale): adire resist-dye repeats in green and ink, ankara wax print motifs in green and yellow, Uli flowing line work, Hausa geometric zigzag and triangle borders, danfo yellow and black stripes.

### 17.4 Text in graphics

- Default: no text inside PNG art. Overlay real HTML text styled with Graphik.
- If an asset must contain text (OG images, social cards, the wordmark, install guides), compose it in code with the real Graphik TTF: `scripts/graphics/compose.mjs` using `@resvg/resvg-js` with `font: { fontFiles: [...], loadSystemFonts: false }`, or `next/og` for OG routes. Never let an image generator draw letters.

### 17.5 Pipeline

1. Read `design/PROMPTS.md` (create it in Phase 0 with the style lock above as a reusable preamble plus one prompt per asset ID).
2. Generate each asset with the available image generation tool using the style lock, saving the master PNG in `design/masters/`. Review at 100 percent zoom. Reject images with garbled pseudo-text, broken hands, uncanny faces, off-palette color or inconsistent style, and regenerate.
3. Optimize with `scripts/graphics/optimize.mjs` (`sharp`): resize variants, compress, produce blur placeholders, write dimensions to the manifest.
4. Add alt text to the manifest and to the page that uses the image.
5. If no image generation tool is available in this environment, do not substitute stock photos or emoji. Produce a clean placeholder at the final dimensions (flat brand color with a pattern tile), mark the asset PLACEHOLDER in the manifest, finish the rest of the work, and give the owner a list of assets still to generate with their ready prompts.
6. Layered hero: generate the three layers on the same canvas so they align, with transparent backgrounds for mid and front.

### 17.6 Brand build

`npm run brand` regenerates all logo exports, favicons, PWA icons, the monochrome push badge and the default OG image from the SVG sources and Graphik. Logo direction: a rounded speech bubble that forms a lowercase `g`, with three vertical sound bars inside it (two green, one yellow). Wordmark: lowercase `gistroom` in Graphik Bold with tight tracking and rounded optical tweaks. Must be legible at 16 px and distinctive at 512 px. Provide a one-color version and an inverted version.

---

## 18. Copy and voice

Clean Nigerian English with warmth and a little spice. People should feel like a friend wrote it.

Principles

- Say what the thing does. Active voice. Sentence case. Short sentences.
- Slang is seasoning. At most one slang phrase per screen, only in low-stakes moments: empty states, loading, greetings, success, landing page headlines.
- The test: would someone from Kano, Port Harcourt and Lagos all understand it? If not, use plain English.
- Never use slang in: legal text, security messages, OTP emails, deletion and data export confirmations, error messages that involve account or data safety, moderation messages.
- Never mock, never use tribe or religion for humor, never use slurs.
- Errors say what happened and what to do next, with no apology and no vague phrases ("Something went wrong" is banned).
- No AI-sounding filler. The copy linter bans phrases such as "seamless", "seamlessly", "unlock the power", "game-changer", "cutting-edge", "revolutionize", "supercharge", "elevate your", "in today's fast-paced", "delve", "leverage" (as a verb), "robust solution".

Approved slang (use correctly, do not invent others): gist, abeg, no wahala, oya, sharp sharp, wetin, how far, e don do, sabi, shakara (only on playful settings), gbedu (music Rooms), owambe (party Rooms), chop (food Rooms), naija.

Microcopy bank (starting point, keep in `content/microcopy.ts`)

| Moment                     | Copy                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Empty chats                | "No gist yet. Pick a friend and start talking."                                                            |
| No chat selected           | "Pick a chat, or start a new one."                                                                         |
| Loading                    | "Abeg wait small."                                                                                         |
| Offline                    | "You are offline. Your messages will send when the network returns."                                       |
| Reconnecting               | "Reconnecting to the room. Hold on."                                                                       |
| Rate limited               | "Easy, easy. Try again in {seconds} seconds."                                                              |
| Friend request unavailable | "You can't send a request to this person right now."                                                       |
| Room full                  | "This room is full. Try again in a minute."                                                                |
| Not invited                | "You are not invited to this room. Ask the host for a link."                                               |
| Room ended                 | "This room has ended. Browse live rooms or start your own."                                                |
| Missed call                | "Missed call from {name}."                                                                                 |
| Mic blocked                | "Gistroom can't reach your microphone. Allow it in your browser settings, then try again."                 |
| Camera blocked             | "Camera is blocked. You are still in audio. Allow the camera in your browser settings to switch to video." |
| Empty notifications        | "Nothing new. We will tell you when something happens."                                                    |
| Welcome after onboarding   | "You are in. Find your people."                                                                            |
| OTP email subject          | "Your Gistroom code" (plain, no slang)                                                                     |
| 404                        | "This page is not here. Head back home."                                                                   |
| Install on iOS             | "Add Gistroom to your Home Screen to get call and message alerts."                                         |

Buttons use verbs: "Enter Gistroom", "Start a room", "Send request", "Accept", "Decline", "Copy link", "Forward", "End room".

---

## 19. Email

Sent only from the web app through Nodemailer. Realtime requests sends through the internal endpoint.

- Transport modes: `console` (default in dev), `capture` (tests, writes to a file, no network), `smtp` (needs `MAIL_ENABLE_REAL=true`). A mailer guard blocks any recipient outside `MAIL_ALLOWED_DOMAINS` in non-production environments. Tests never send real email.
- Gmail SMTP caps daily volume. The `EmailOutbox` retries failed non-sensitive emails. OTP and security emails are never queued for later (an expired code is useless), they fail loudly and the UI says so.
- Layout: single column table-based HTML, inline CSS, 600px, brand header with the PNG logo, big readable code block for OTP, preheader text, footer with support address and legal links, dark mode friendly, plain-text alternative for every template, system font fallback stack.
- Templates (registry with ID, Zod props schema, defaults): `verify-otp`, `reset-otp`, `delete-account-otp`, `account-exists`, `welcome`, `new-device-sign-in`, `missed-call`, `friend-request` (throttled), `room-invite`, `room-starting-soon`, `data-export-ready`, `account-deleted`, `report-received`, `report-resolved`, `contact-received`, `contact-inbox`, `room-ended-summary`, `activity-digest`. Every email that is not a security notice greets by first name, has a specific subject and a manage preferences link, and shows times in the recipient's zone in 12 hour format.
- `npm run mail:preview` renders every template to `.mail-preview/` (git-ignored). A unit test renders every template with sample props and runs the copy linter over the output.

---

## 20. Security

- Headers set in the middleware or proxy file (use whichever name the installed Next.js expects), with a per-request nonce:
  - CSP: `default-src 'self'`; `script-src 'self' 'nonce-{n}' 'strict-dynamic'`; `style-src 'self' 'nonce-{n}'` and `style-src-attr 'unsafe-inline'` (Motion sets inline styles); `img-src 'self' data: blob: https://*.supabase.co`; `media-src 'self' blob: https://*.supabase.co`; `font-src 'self'`; `connect-src 'self'` plus the realtime origin (https and wss), LiveKit (https and wss) and Supabase; `worker-src 'self' blob:`; `manifest-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self' https://accounts.google.com`; `frame-ancestors 'none'`; `upgrade-insecure-requests`; report to `/api/csp-report` (rate limited).
  - `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: microphone=(self), camera=(self), geolocation=(), payment=()`. Do not block the mic and camera that calls need.
- CORS: only on the realtime service, allow-list from `ALLOWED_ORIGINS`, no wildcard, `credentials: false` (token auth). Socket.IO gets the same allow-list. Internal endpoints require the bearer service token and are not browser reachable.
- Rate limits (HTTP via database limiter on web, `express-rate-limit` plus per-socket buckets on realtime):

| Action          | Limit                                    |
| --------------- | ---------------------------------------- |
| OTP send        | 5 per hour per email, 20 per hour per IP |
| OTP verify      | 5 attempts per challenge                 |
| People search   | 30 per minute                            |
| Friend requests | 10 per hour, 30 per day                  |
| Messages        | 60 per minute                            |
| Media sign      | 30 per minute                            |
| Room create     | 10 per hour                              |
| Call start      | 10 per minute                            |
| Reports         | 10 per hour                              |
| Contact form    | 5 per hour per IP                        |

- Input: Zod on every route and every socket payload. Output: never return other users' emails. Public profile data is name, username, avatar and bio only.
- Media: magic byte checks, extension and MIME allow-lists, size caps, private bucket, signed URLs, EXIF stripping, orphan sweep. Report path for abusive media and a takedown process documented in SECURITY.md and the Safety page.
- Authorization: write one permission module per domain (friends, chat, calls, rooms) with a pure function matrix that is unit tested, and call it from both REST and sockets.
- Secrets: validated env, no secrets in logs (pino redaction for tokens, cookies, emails in debug), structured logs with request IDs.
- Dependency hygiene: `npm audit` in CI (fail on high), Dependabot config.
- Legal: Terms, Privacy, Acceptable Use, Cookies. Age confirmation of 18 or older (D8). The owner reviews the legal copy against the NDPA and Cybercrimes Act before public launch.

---

## 21. Testing and the verify pipeline

Everything runs from the repo root. Tests live in `/tests` (and small colocated unit tests are allowed next to code if they are listed in the Vitest include). Shared helpers in `tests/helpers`.

### 21.1 Scripts

| Script                                           | What it does                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dev`                                            | starts web (3000) and realtime (4000) together with `concurrently`                                                                                                                                                                                                 |
| `build`                                          | generates Prisma client, builds shared, web and realtime                                                                                                                                                                                                           |
| `lint`                                           | ESLint (typescript-eslint, jsx-a11y, `no-restricted-imports` for toast libs and server-only imports, no `any`, no `console`) and Prettier check                                                                                                                    |
| `typecheck`                                      | `tsc --noEmit` across workspaces                                                                                                                                                                                                                                   |
| `lint:copy`                                      | `scripts/check-copy.mjs`: fails on em dash, en dash, horizontal bar, figure dash, emoji, banned AI phrases, in source, content, docs, emails and (in the hook) the commit message                                                                                  |
| `lint:ui`                                        | `scripts/check-ui-rules.mjs`: fails on `<select>`, HTML validation attributes, missing `noValidate`, toast imports, `alert(`, raw hex colors outside tokens, raw font-family outside tokens, `localStorage` holding tokens, images without alt                     |
| `lint:font`                                      | `scripts/check-font-coverage.mjs`                                                                                                                                                                                                                                  |
| `lint:graphics`                                  | `scripts/graphics/verify.mjs`                                                                                                                                                                                                                                      |
| `test:unit`                                      | Vitest unit                                                                                                                                                                                                                                                        |
| `test:integration`                               | Vitest integration against the `gistroom_test` schema, real Postgres, mocked LiveKit and web-push                                                                                                                                                                  |
| `test:socket`                                    | Socket.IO integration with `socket.io-client`                                                                                                                                                                                                                      |
| `test:browser`                                   | Playwright (Chromium) flows                                                                                                                                                                                                                                        |
| `test:a11y`                                      | axe scan of every public page and key app screens                                                                                                                                                                                                                  |
| `test:responsive`                                | overflow and tap-target audit at 320, 390, 768, 1440                                                                                                                                                                                                               |
| `verify`                                         | in order: `lint:copy`, `lint:ui`, `lint:font`, `lint`, `typecheck`, `lint:graphics`, `test:unit`, `test:integration`, `test:socket`, `build`, `test:browser`, `test:a11y`, `test:responsive`                                                                       |
| `verify:changed`                                 | runs only what the changed files need: copy and ui rules, eslint and prettier on those files, typecheck, Vitest `--changed`, and the Playwright specs that map to the changed areas. For day to day work. The full `verify` still runs in CI and before a release. |
| `verify:quick`                                   | `lint:copy`, `lint:ui`, `lint`, `typecheck`, `test:unit` (used by hooks)                                                                                                                                                                                           |
| `db:migrate`, `db:seed`, `db:reset`, `db:studio` | all go through `assert-safe-db.mjs`                                                                                                                                                                                                                                |
| `brand`, `mail:preview`, `graphics:optimize`     | asset and email tooling                                                                                                                                                                                                                                            |

`npm run verify` must run after every fix and every feature. Do not report done on red.

### 21.2 What `check-copy.mjs` must do

- Scan `apps`, `packages`, `scripts`, `tests`, `wiki`, root markdown, email templates and content files, excluding `node_modules`, `.next`, lockfiles and binary files.
- Fail on U+2014, U+2013, U+2015, U+2012, and any `\p{Extended_Pictographic}` character, plus U+FE0F, U+200D joiners used in emoji sequences, keycap U+20E3 and regional indicators U+1F1E6 to U+1F1FF. Write these in the script as escapes so the script itself passes.
- Fail on banned phrases from `scripts/banned-phrases.json` (case-insensitive).
- In `--commit-msg` mode, check one file (the commit message) and also strip co-author trailers.
- Print file, line, column and the offending character name. Fixture-test the checker itself.

### 21.3 Coverage expectations (minimum)

- Unit: Zod schemas, constants invariants (video publishers not above room max), friend cooldown logic, mutual request auto-accept, call state machine and glare resolution, Room permission matrix (host, moderator, member, banned, invited, uninvited), invite link expiry and use counting, cursor encode and decode, message ordering and idempotency, rate limiter, notification dedupe, push payload builders and TTL rules, voice mime negotiation, slug and username rules, copy checker, UI rules checker.
- Integration: OTP flow and lockouts, Google mock flow and account linking, sessions and revocation, search rules (blocked, deleted, non-discoverable excluded), friend lifecycle, DM send idempotency, delete for me and for everyone, archive, star, media authorization and signed URL expiry, notifications and preferences, push subscription lifecycle with 404 and 410 handling, call lifecycle with mocked LiveKit, ring timeout through the catch-up sweeper, Room join matrix (public, private, invited, link valid, link expired, banned, full, locked), moderator actions and the mod log, host transfer, rejoin grace, call logs filter, search and pagination, reports, account deletion and export, rate limits, sitemap and robots content, every public route returns metadata.
- Socket: expired pass rejected, per-event authorization, presence and privacy, typing, delivery and read receipts, reconnect resync, over-limit behavior.
- Browser (Playwright, two browser contexts where needed): landing renders and header states, signup with a captured OTP email, Google mock sign in, send and accept friend request, real-time DM between two contexts, image upload, voice note using Chromium fake media flags (`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`), offline queue with `context.setOffline`, create public and private Room, not-invited screen, 1:1 call and audio to video switch (tag `@live`, runs against the LiveKit dev project, run nightly and before release), service worker registration, push handling by delivering a push message through the DevTools protocol, manifest validity, install card, SEO assertions on every public page (title, description, canonical, one h1, JSON-LD parses), axe on every public page.
- Test data uses prefixes, cleans up, never touches any schema except `gistroom_test`.

### 21.4 Hooks and CI

- Husky: `pre-commit` runs lint-staged (copy check, ESLint, Prettier on staged files) and `typecheck`; `commit-msg` runs the copy check on the message and strips co-author trailers; `pre-push` runs `verify:quick`.
- GitHub Actions `ci.yml` on every push and pull request: install, Playwright browsers, `npm run verify`, `npm audit --audit-level=high`. The browser job uses the test schema through repository secrets.

### 21.5 Definition of done (every task)

1. `npm run verify` is green.
2. New behavior has tests at the right level.
3. Strings are in `content/`, icons are Lucide, tokens are used, motion respects reduced motion.
4. Empty, loading, error and offline states exist.
5. Docs, wiki and CHANGELOG are updated.
6. A screenshot check at 360, 768 and 1440 for any UI change.

---

## 22. Dev workflow and Git

- First run: Claude installs everything itself (`npm install`, Husky, Playwright browsers), copies `.env.example` to `.env`, tells the owner exactly which secrets to fill in, and runs the scaffold. The owner then only runs `npm run dev`.
- `npm run dev` starts both services with prefixed colored logs, restarts on change, and fails fast with a readable message if env validation fails.
- `npm run db:seed` creates clearly fake demo users, friendships, conversations and a few Rooms in the dev schema only. Demo emails use `example.com`.
- Branching: work on short branches, merge to `main` when verify is green. Small commits. Messages follow R21.
- `.gitattributes` forces LF. `.editorconfig` sets 2 spaces, UTF-8.
- Never commit `.env`, keys, Supabase service role, LiveKit secrets or VAPID private key.

---

## 23. Documentation to produce

- `README.md`: what Gistroom is, screenshots, architecture overview (Mermaid diagrams for system context, containers, deployment, auth flow, call flow, Room lifecycle, notification delivery), quick start (`npm install`, `.env`, `npm run dev`), env variable table, commands table, deployment summary, tests, launch checklist, links to the wiki.
- `wiki/`: `Home`, `Architecture`, `Realtime`, `Notifications-and-Push`, `PWA`, `Auth`, `Chat`, `Calls`, `Rooms`, `Safety-and-Moderation`, `Security`, `Design-System`, `Graphics`, `Copy-Guide`, `Email-Templates`, `SEO`, `Testing`, `CI`, `Deployment`, `Edge-Cases`, `Decisions` (decision log with date and reason).
- `SECURITY.md`: supported versions, how to report (`security@gistroom.ng`), response times, scope, safe harbor wording.
- `CONTRIBUTING.md`: setup, the rules in Section 2, verify, commit style, PR checklist.
- `CHANGELOG.md`: Keep a Changelog format, updated with every merged slice.
- `LICENSE`: decision D9.
- All docs obey R1 and R2 and are scanned by `lint:copy`.

---

## 24. Performance and accessibility budgets

| Metric                                  | Budget                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Landing LCP (mobile, slow 4G emulation) | under 2.5 s                                                                     |
| CLS                                     | under 0.05                                                                      |
| INP                                     | under 200 ms                                                                    |
| Landing initial JS (gzip)               | under 170 KB                                                                    |
| Authed shell initial JS (gzip)          | under 250 KB, heavy parts (emoji picker, LiveKit, charts, Lightbox) lazy loaded |
| Hero image (shipped)                    | under 250 KB for the LCP layer                                                  |
| Any other illustration (shipped)        | under 180 KB at its largest size                                                |
| Lighthouse (mobile)                     | Performance 90+, Accessibility 100, SEO 100, Best Practices 95+                 |
| Call join to first audio                | under 3 s on a warm connection                                                  |

Accessibility: keyboard reachable everything, focus rings visible, focus trapped in modals, `aria-live` for incoming calls, connection changes and new Room members, labelled icon buttons, 44px targets, color is never the only signal (speaking uses a ring plus an icon), captions for any video content we author.

---

## 25. Phases

Do not start a phase until the previous phase is green and documented.

**Phase 0: Foundation.** Monorepo, tooling, tokens, Graphik setup and coverage check, env validation, Prisma baseline and `assert-safe-db`, CSP and headers, `FeedbackProvider`, core UI components, `verify` pipeline, hooks, CI, brand build (logo, favicon, PWA icons, OG), graphics manifest and prompts, landing v1 (Voice Dock header, hero with placeholder or real art, footer, scroll to top), README and wiki skeleton.
Exit: `npm run dev` works, `npm run verify` green, deployed to Vercel and Render with health checks.

**Phase 1: Identity.** Email OTP, Google OAuth, sessions and devices, onboarding, profile, settings shell, people search, rate limits, auth page art.
Exit: sign up, sign in, sign out, Google link, search all tested.

**Phase 2: Social, chat text and notifications.** Friends, DMs (text, receipts, typing, presence), realtime service, in-app notifications, Web Push, service worker, PWA install, offline shell and queue, badge.
Exit: the stale tab scenario passes in a browser test using a simulated push.

**Phase 3: Chat media.** Uploads, images, videos, files, voice notes, media grid, star, archive, delete, reactions, reporting.

**Phase 4: Calls.** 1:1 audio and video, switching, ring, glare, busy, multi-device, call logs tab, data saver.

**Phase 5: Rooms.** Create and schedule, public and private, invite links, forward, moderators, mod log, limits, rejoin grace, Room chat, discover, topics, language tags.

**Phase 6: Public site and polish.** Full landing with all widgets, About, Features, Security, Safety, Support, Install, legal pages, topic pages, SEO complete, all graphics approved, all email templates, empty states with art, 404 and 500 pages.

**Phase 7: Admin and hardening.** Admin console and charts, audit log, performance pass against budgets, accessibility audit, load sanity checks, docs complete, launch checklist, v1.0.0 changelog entry.

---

## 26. Constants (`packages/shared/src/limits.ts`)

```ts
export const LIMITS = {
  // Rooms
  ROOM_MAX_PARTICIPANTS: 32,
  ROOM_MAX_VIDEO_PUBLISHERS: 32, // may never exceed ROOM_MAX_PARTICIPANTS (unit tested)
  ROOM_TITLE_MAX: 80,
  ROOM_REJOIN_GRACE_SEC: 120,
  ROOM_EMPTY_END_GRACE_SEC: 60,
  INVITE_LINK_DEFAULT_TTL_HOURS: 24,
  INVITE_LINK_TTL_OPTIONS_HOURS: [1, 12, 24, 168],
  // Calls
  CALL_RING_TIMEOUT_SEC: 45,
  CALL_PEER_GONE_SEC: 60,
  HEARTBEAT_GONE_SEC: 20,
  // Rooms, reliability
  ROOM_REMOVE_COOLDOWN_MIN: 10,
  ROOM_MAX_DURATION_HOURS: 8,
  ROOM_EMPTY_SWEEP_MIN: 5,
  HOST_RECONNECT_GRACE_SEC: 120,
  ROOM_RING_COOLDOWN_SEC: 30,
  ROOM_RING_PER_ROOM: 3,
  ROOM_RING_WINDOW_MIN: 10,
  ROOM_CHIP_CROWD: 24,
  ROOM_SOUND_MAX_PEOPLE: 12,
  // Auth
  OTP_LENGTH: 6,
  OTP_TTL_MIN: 10,
  OTP_RESEND_COOLDOWN_SEC: 60,
  OTP_MAX_ATTEMPTS: 5,
  OTP_SENDS_PER_HOUR: 5,
  SESSION_DAYS: 30,
  SESSION_MAX_DAYS: 90,
  SESSION_SWEEP_GRACE_DAYS: 7,
  RECENT_AUTH_MIN: 15,
  PUSH_GRACE_DAYS: 30,
  PUSH_STALE_DAYS: 90,
  PUSH_UNHEALTHY_FAILURES: 3,
  DEVICE_COOKIE_DAYS: 365,
  REALTIME_PASS_MIN: 15,
  // Social
  FRIEND_REQUEST_COOLDOWN_DAYS: 7,
  FRIEND_REQUESTS_PER_HOUR: 10,
  FRIEND_REQUESTS_PER_DAY: 30,
  // Chat
  MESSAGE_MAX_CHARS: 4000,
  DELETE_FOR_EVERYONE_WINDOW_MIN: 15,
  EDIT_WINDOW_MIN: 15,
  VOICE_NOTE_MAX_SEC: 300,
  IMAGE_MAX_RAW_MB: 15,
  IMAGE_TARGET_KB: 1500,
  MAX_VIDEO_UPLOAD_MB: 50, // CONFIRM with owner (see D10)
  FILE_MAX_MB: 20,
  // Profile
  NAME_MAX: 60,
  USERNAME_REGEX: /^[a-z0-9_]{3,20}$/,
  // Lists
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50],
  SEARCH_MIN_CHARS: 2,
} as const;
```

Language tags: `ENGLISH`, `PIDGIN`, `YORUBA`, `IGBO`, `HAUSA`, `OTHER`.

Seed topics: Football, Music and Gbedu, Politics and Governance, Tech and Startups, Business and Money, Relationships, Faith and Life, Campus Life, Nollywood and Entertainment, Food and Chop, Health and Wellness, Careers and Jobs, Education, Comedy, Diaspora and Japa, Fashion and Owambe, Gaming, Open Gist.

---

## 27. Decisions and open items

Defaults are chosen so work never blocks. The owner can change any of them; update this section and `wiki/Decisions.md` when that happens.

| ID  | Decision                                                                                                                                                                                                 | Status                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| D1  | Email and password plus Google. A code only at sign up, password reset and account deletion. Changed by the owner on 2026-10-10 from the passwordless default.                                           | Default, owner may switch to password plus OTP like Job Central |
| D2  | One Supabase project, schemas `gistroom_dev` and `gistroom_test`, production gets its own project later                                                                                                  | Default                                                         |
| D3  | Archived chats stay archived when new messages arrive                                                                                                                                                    | Default                                                         |
| D4  | Delete for everyone allowed for 15 minutes (changed from 60 by the owner on 2026-10-12)                                                                                                                  | Decided                                                         |
| D5  | Account deletion anonymizes the person in others' chats and keeps reports                                                                                                                                | Default                                                         |
| D6  | Private Room: only invited people enter. A valid expiring invite link adds the opener to the invite list.                                                                                                | Default                                                         |
| D7  | Graphik web license held by the owner                                                                                                                                                                    | Owner to confirm                                                |
| D8  | Minimum age 18, confirmed at onboarding                                                                                                                                                                  | Default                                                         |
| D9  | License file: all rights reserved until the owner chooses (Job Central used MIT)                                                                                                                         | Owner to choose                                                 |
| D10 | Owner said "max room 32, max video 50". Read as 32 participants per Room and 50 MB maximum video upload in chat, with every participant allowed to publish video up to the Room cap                      | Owner to confirm                                                |
| D11 | Language: English only for v1. Multilingual UI (Pidgin, Yoruba, Igbo, Hausa) planned for a later version. Strings are already centralized (R10). Room language tags are a separate feature and ship now. | Decided                                                         |
| D12 | Stage mode and raise hand                                                                                                                                                                                | Later, after Phase 5                                            |
| D13 | Domain `gistroom.ng`, apex canonical, `www` redirects                                                                                                                                                    | Decided                                                         |

Owner tasks (Claude will list exact steps when each is needed): open Supabase and LiveKit Cloud projects, create Vercel and Render projects, create Google OAuth credentials, create a Gmail app password, generate VAPID keys (script provided), point `gistroom.ng` DNS, set up the uptime pinger, confirm the font license, review legal copy.

---

End of file. When in doubt, re-read Section 0, then Section 2.
