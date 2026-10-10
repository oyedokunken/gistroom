# Changelog

All notable changes to Gistroom. Format follows Keep a Changelog.

## [Unreleased]

### Added

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
