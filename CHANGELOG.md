# Changelog

All notable changes to Gistroom. Format follows Keep a Changelog.

## [Unreleased]

### Production migrations to run

- `20261013120000_user_is_seed`: marks seeded test people so they can be removed in one command.

- `20261013090000_sessions_push_devices`: session end reasons, device id and sign in time on sessions, device id, label, health and sign out fields on push subscriptions.
- `20261013091000_push_session_ended`: when the session on a device ended.

These are applied to the dev and test schemas already. Run them on production with `npm run db:migrate:deploy`, in this order. Nothing was run against production by the build.

- `20261012100000_topics_expand`: the wider topic list.
- `20261012085415_user_cookie_consent`: the saved cookie choice on the account.
- `20261012095014_settings_email_change_internal`: email change fields and the internal account flag.
- `20261012102631_room_settings_reactions_activity`: room settings, room reactions and activity expiry.
- `20261012140000_room_invite_link_token`: the link token that lets active links show in full.

### Test data and polish

- Rooms get a topic picture as their avatar in call logs, Past rooms and the room header. Stage tiles size themselves from the screen and the number of people. Chat call cards fill the width they have, and call logs use two columns on desktop. Times everywhere use 12 hours.
- A scheduled room now has a lobby for people who are not the host: Remind me puts you on the list, and you get a notice (in the app and as a push) the moment the host starts it. The seed adds rooms hosted by the two test accounts that start soon.
- Username and email can no longer be changed. Profile pages show Friends since. The emoji picker stays open for several picks. Voice notes in the upload tray read Voice note. The chats empty pane uses a picture, and Discover ends with the topic cards.
- Export my data is now a PDF report written by a small built in writer (no new dependency), and downloading it adds a notice to your list.

- `npm run seed:friends` builds a test world of 30 Nigerian people around real accounts, with chats, calls and rooms, and `--remove` deletes all of it. `npm run seed:act` makes a seeded person message or friend request a real account. See `wiki/Test-Data.md`.
- Chat heads show a green dot and Active now or Last seen for the other person, from the server as well as the socket. Calls appear in the middle of a chat with a voice or video icon, how long it lasted and when it started, and never count as unread.
- Signing in with an email or username that has no account stops at step one. Auth fields have placeholders, the Terms and Privacy Policy are links, and confirm password sits under the password with the rules after it.
- A friend request alert shows who sent it with a link to their profile, and shows Accepted once you accept.
- The topic picker has search that understands Nigerian words, popular topics first and the full list behind a button. Emails use the landing page logo. Settings opens on Profile.

### Sessions and alerts

- People stay signed in for 30 days, sliding, up to 90 days. The cookie is renewed on page loads, so it no longer ends 30 days after sign in for someone who uses Gistroom every day.
- The real causes of surprise sign outs are fixed: the cookie was never renewed, and the realtime socket treated any failed pass fetch (offline, a cold start, a database blip) as a sign out. It now checks with the server first and retries.
- Every session end records a reason and is logged. `npm run sessions:ends` shows the last 50.
- Alerts no longer depend on the session. Subscriptions belong to a device, survive a session ending, and keep arriving as plain text for 30 days, then stop until the person signs in again. Signing out on purpose removes that device's alerts, and a browser used by someone else moves its alerts to the new person.
- Tapping a notification with an ended session signs in and returns to the same place.
- Settings, Notifications has a device health panel with a real test button, a device list and help for the usual reasons alerts stop.
- Exporting your data and setting a first password ask for a recent sign in.

- `DATABASE_POOL_MAX` caps the database pool per process. `QA_PASSWORD` is read only by `npm run seed:qa` and is never stored.

### Removed

- Room chat is deleted the moment a room ends. The 24 hour keep time is gone, and reports keep their own evidence snapshot.

- The pattern tile placeholder images, their generator and the two unused auth scenes.

### Added

- Rooms: a searchable topic list, an Audio or Video type, Public or Private wording, room settings that change live (cameras, join muted, who can chat, slow mode, reactions, link sharing, lock), mute audio or turn off video for one person, mute everyone with an optional moderator only unmute, a leave modal for hosts, floating reactions, reactions on chat messages, chat with avatars and role badges, and a summary page for ended rooms with Past rooms for every person.
- Invite friends by name with a Room invite card in each chat, and invite links that last 1 hour, 12 hours, 1 day or 7 days, show in full with a Copy button and revoke at once. Revoked or expired links say so plainly.
- Chat: ten quick reactions with a full picker, the edit time on edited messages, a 15 minute window to edit or delete for everyone, and a confirm modal before archiving.
- Notifications: a detail modal for each item, select and bulk read, unread or delete, an Activity tab with Undo, grouping by day and a Room ended notice.
- Email: personalised room invite, room starting soon, welcome, room summary and friend request digest messages with a manage preferences link, and a reminder 15 minutes before a scheduled room.
- Realtime: `/health` reports uptime and socket counts, and socket tests cover every room event.
- QA: `npm run seed:qa` for six internal accounts, a larger demo world with `npm run seed:demo`, `wiki/QA-Runbook.md` and live tests for moderation and the camera switch.
- Private notes for every chat and every room, kept by the person who wrote them, with add, edit, delete and search.
- One search for people by name or username, your chats, public rooms and your notes, opened with Ctrl K, a slash or the search button.
- The Gistroom floating button on every main screen with Start a room, Find a friend, New chat, Starred and Take the tour, plus a Welcome back message after sign in.
- Seeding that reads the whole schema: the eighteen topics for any database, and a labelled demo world for dev and test schemas only.
- Real art for For you and interests: two animated scenes and seven new icons.

- A set password step between the email code and the profile, a sign in check that sends unknown emails to sign up and half finished sign ups back to their code, and plain messages for emails with or without an account.
- A keepalive workflow that pings the realtime and web health checks every 14 minutes, and a web health check that reads the database.

- Animated flat scenes for every auth page, one per flow: a Lagos street with danfo, keke, okada, playing children and a police officer for login, a stadium crowd for sign up, a code phone for verify, a flying letter for forgot and a profile card for onboarding. All loop forever with a static PNG fallback for reduced motion.
- A live room phone mock on the /rooms hero with working audio and video tabs, a notes side panel and a raise hand demo, shared with the process accordion on the landing.
- Behind the scenes tool cards on About with real brand marks served locally from the repo.
- A developer section on About with an animated coding workspace (syntax coloured code, drifting chips, lamp, clock) and a cycling maker avatar inside the developer link.
- Two Open Graph image variants, green and white, generated by `scripts/graphics/og.mjs`.
- Custom PNG icons above section headings across the public pages, including a new swap arrows icon for the call switching section.
- A Google Meet style notes panel in the landing room demo that slides in from the right and rearranges the call tiles.
- A two row topic card marquee on the landing and a browse by topic band on /rooms.
- A kicker pill, a green grid pattern and a yellow second button on the landing hero.
- A changelog page redesign with per group icons, check lists and change counts.
- A forgot password link on the first step of login and beside the password label on the second.
- An axe accessibility check on every public page (`npm run test:a11y`) and `@responsive` tags on the viewport tests (`npm run test:responsive`).

### Changed

- Modals, menus and popovers now sit above the room screen, so confirmations inside a room are visible.
- Invite links open the app, where they are checked. A signed out visitor signs in first and returns to the link.
- Internal QA accounts and their rooms are hidden from search, suggestions, Discover, counts and public pages for everyone else.

- FAQ accordions keep one question open at a time through native named details, highlight yellow on hover and when open, and sit in two columns on desktop.
- The landing process accordion shows collapsed steps as yellow strips, the open step as a white card, and a transparent wash on hover.
- The rooms explorer keyword chips drive the live search again and the empty state offers a Start a room link.
- CTA bands are shorter with smaller floating icons.
- The security page joins the honest note and the report card into one two column section with per card icons and buttons.
- Animated WebP scenes loop forever (loop count 0) and `lint:graphics` accepts 0 as infinite.
- The cookie banner uses the PNG mascot and stays free of public chrome imports.
- Low contrast white text on green cards and icon buttons without labels now meet WCAG AA across the public pages and the phone mocks.

### Added

- Rooms: start or schedule a room, public and private, join with the 32 person cap, lock, mute and mute all, remove, ban, promote and demote, transfer host, host leaves handoff, 120 second rejoin grace, empty rooms end after 60 seconds, invite friends, invite links (1 hour, 24 hours, 7 days, use limits, revoke), forward to chats, room chat kept 24 hours, and a moderator log for the host. Needs LiveKit keys.
- Calls: 1:1 audio and video with a full screen call, an incoming call ring on every screen, answering, declining, cancelling, ring timeout, glare merging, busy handling, switching between audio and video in the call, a weak network banner, wake lock, and a call log with filters, search and pagination. Needs LiveKit keys.
- Friendship anniversaries: on the day two friends reach a year, a card appears in their chat with confetti (not shown when the visitor prefers reduced motion).
- Attachments and voice notes: private Supabase uploads with magic byte checks, photos compressed on the phone with location removed, previews, a lightbox, video player, voice notes with a recorded waveform and 1x, 1.5x and 2x playback, and file cards for PDF, Word, Excel, PowerPoint, text and CSV. Profile photo upload in Settings. Run `npm run storage:setup` once to create the buckets.
- Chat: edit a message for 15 minutes (shows Edited), typing bubble and typing line under the avatar, swipe right to reply, reactions that update at once and roll back with a clear error, block that shows the blocked person only an unavailable chat, report a chat with the last 20 messages kept as evidence, chat settings, starred messages list, audio and video call buttons with a confirmation modal, and a quick actions button on the chat list. Run `npm run db:migrate` for the new editedAt column.
- Public pages rebuilt with full width bands, device mocks, bento tiles and steps (features, about, security, safety, install), a contents list on long pages, and a rooms page with one large live search plus a few keyword chips.
- Scrollbars are hidden everywhere. Scroll position is a waveform at the bottom centre on desktop and a speedometer gauge around the chat button on phones.

### Changed

- Phase 2 client: realtime provider (fresh pass on every reconnect, resync after any gap, focus reporting, app badge), chat list, virtualised thread, bubbles with receipts, reply, star, react and delete, composer with drafts and typing, own emoji picker, offline outbox in IndexedDB that flushes in order, friends page (friends, requests, sent, find people), profiles, notifications page, push opt in with a primer, service worker (push, notification clicks, offline page, update modal), install card and settings for notifications and install.

- Phase 2 backend: friends (requests, auto accept on mutual requests, 7 day rejection cooldown that never says rejected, unfriend, block), DMs (idempotent send, delete for me and for everyone, star, react, archive, clear, receipts), notifications (aggregated DMs, preferences, quiet hours, read, clear), Web Push subscriptions, and the realtime service (pass auth, per event authorization, presence with privacy, typing, receipts, rate limits, internal event fan out, push delivery with TTLs, scheduler). 42 socket tests run against an in memory store.

- Phase 1 identity (built without a database, integration tests skip until Supabase exists): OTP request and verify routes, sessions and devices, Google sign in with a mock mode, onboarding with live username check, people search (name and username trigram), realtime pass, DB backed rate limiter, login, signup, verify and onboarding pages, the signed in app shell (rail and tab bar) and settings (profile, privacy, devices, appearance, data saver).

- Back to top is now ScrollWave: the page is a voice note with a waveform scrubber (drag, tap or keys) and the footer wordmark replays from the top (D27).
- Footer on phones: Made in Nigeria and the builder link share one row, separated by a dot.

- Light mode is the default. Theme control offers Light, Dark and System (D24).
- Attribution: Gistroom is built by @oyedokunken (D25).
- Hero: text left and image right on desktop at equal height, image first on mobile.
- Mobile header: the capsule contracts into the mic bubble on scroll, the dock has an entrance, press blob and a pulsing center button. The footer waveform plays on touch screens.

### Changed

- Footer: endless waveform behind the wordmark (pauses only off screen), descender no longer clipped, 2 by 2 link grid on mobile, theme switcher above Made in Nigeria and the builder link on one row, scroll to top no longer covers the last row.
- Mobile dock center button uses a chat icon.

### Added

- Identity groundwork that needs no database: shared Zod schemas (email, code, username with reserved words, onboarding, search), OTP generation, hashing and verify decisions, send cooldown and hourly cap, session tokens and cookie attributes, realtime pass signing and verifying, origin check, and the mailer (console, capture and smtp transports, recipient guard, sign-in code templates, `npm run mail:preview`).

- Monorepo with npm workspaces: `apps/web`, `apps/realtime`, `packages/shared`, `packages/db`.
- Quality gates: copy checker, UI rules checker, font coverage check, graphics manifest check, safe database wrapper.
- Prisma baseline schema and migration for the full data model.
- Graphik font setup with a Noto Sans fallback for Nigerian letters.
- Core UI components: Button, IconButton, Input, Textarea, Field, Modal, Sheet, Select, Tabs, Tooltip, Badge, Avatar, Skeleton, EmptyState, ConnectionBanner.
- FeedbackProvider with showInfo, showError, showSuccess and confirm (no toasts).
- Nonce based CSP and static security headers through the Next 16 proxy file; pages render per request so scripts carry the nonce.
- Brand build (`npm run brand`): logo mark, wordmark and lockups, favicon, PWA icons, push badge and default Open Graph image.
- Illustration manifest, prompts with the style lock, generated alt text and 33 pattern placeholders; budgets enforced by `lint:graphics`.
- Web App Manifest, icons and default Open Graph metadata.
- Landing v1: the Voice Dock header (capsule with sliding highlight, live room pill, mic bubble with scroll reactive rings, radial menu, mobile thumb zone dock with More sheet), hero with parallax layers, speaking rings, sound bars and drifting sample gist, footer with oversized wordmark and scroll to top ring button.
- `/api/public/stats` live room count (reports zero on any failure), `/api/csp-report`, Organization and WebSite JSON-LD.
- Health endpoints and the realtime service skeleton.
- GitHub Actions CI, Dependabot, Render blueprint, Vercel config, README architecture diagrams, security policy, contributing guide, license notice and the wiki skeleton.
