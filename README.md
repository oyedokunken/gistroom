# Gistroom

Live talk about Nigeria, in Nigeria. Friends, chats, calls and Rooms. Audio first, built for Nigerian data.

Status: Phase 0 (foundation) is done except the first deploy. The full spec is in [CLAUDE.md](CLAUDE.md). Domain: `gistroom.ng`.

Screenshots arrive with the first approved illustrations (see [wiki/Graphics.md](wiki/Graphics.md)).

## Quick start

```bash
npm install
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
node scripts/gen-secrets.mjs   # paste the output into .env
npm run dev
```

Web runs on http://localhost:3000 and the realtime service on http://localhost:4000. Dev and tests use the hosted Supabase project through isolated schemas (`gistroom_dev`, `gistroom_test`). There is no Docker and no local database.

## Architecture

### System context

```mermaid
flowchart LR
  Person[Person in a browser or installed PWA] --> Web[Gistroom web on Vercel]
  Person --> RT[Realtime service on Render]
  Person --> LK[LiveKit Cloud media]
  Web --> DB[(Supabase Postgres)]
  Web --> Store[(Supabase Storage)]
  Web --> LK
  RT --> DB
  RT --> Push[Browser push services]
  Web --> Mail[Gmail SMTP]
  Person --> Google[Google sign in]
```

### Containers

```mermaid
flowchart TB
  subgraph Vercel
    Web[apps/web: pages, REST, auth, email, LiveKit tokens, signed URLs, cron]
  end
  subgraph Render
    RT[apps/realtime: sockets, presence, fan-out, Web Push, schedulers]
  end
  Shared[packages/shared: Zod schemas, event contracts, limits]
  Db[packages/db: Prisma schema and client]
  Web --> Shared
  RT --> Shared
  Web --> Db
  RT --> Db
  Web -- internal events --> RT
  RT -- internal email request --> Web
```

### Deployment

```mermaid
flowchart LR
  GH[GitHub main] --> CI[GitHub Actions: verify]
  GH --> V[Vercel: apps/web]
  GH --> R[Render: apps/realtime]
  Ping[External pinger every 5 minutes] --> V
  Ping --> R
  Owner[Owner machine or CI] -- npm run db:migrate --> S[(Supabase)]
```

Migrations never run inside a build. Email is sent only from the web app because Render free blocks outbound SMTP.

### Auth flow

```mermaid
sequenceDiagram
  participant B as Browser
  participant W as Web
  participant M as Mailer
  B->>W: Request code for an email
  W->>M: Send 6 digit code
  M-->>B: Email with code
  B->>W: Submit code
  W-->>B: Session cookie gr_session
  B->>W: GET /api/realtime/pass
  W-->>B: Signed 15 minute pass
  B->>RT: Connect with pass
```

### Call flow

```mermaid
sequenceDiagram
  participant A as Caller
  participant W as Web
  participant RT as Realtime
  participant B as Callee
  A->>W: POST /api/calls
  W->>W: Check friendship, block, availability
  W-->>A: Call and LiveKit token
  W->>RT: Notify callee
  RT-->>B: call:incoming and Web Push
  B->>W: Accept
  W-->>B: LiveKit token
  Note over A,B: Audio or video flows through LiveKit
```

### Room lifecycle

```mermaid
stateDiagram-v2
  [*] --> SCHEDULED
  [*] --> LIVE
  SCHEDULED --> LIVE: start time or host starts
  LIVE --> LIVE: join, leave, moderate
  LIVE --> ENDED: host ends or empty for 60 seconds
  ENDED --> [*]
```

### Notification delivery

```mermaid
flowchart TB
  Event[Notifiable event] --> Row[Write Notification row]
  Row --> Live{Live focused socket?}
  Live -- yes, not a call --> Socket[Emit notification:new]
  Live -- no, or a call --> Push[Web Push to every subscription]
  Push --> Gone{404 or 410?}
  Gone -- yes --> Revoke[Mark subscription revoked]
  Push --> Email[Optional throttled missed call email]
```

## Environment variables

Every key is listed and commented in [.env.example](.env.example). Both apps validate their environment with Zod at boot. Only `NEXT_PUBLIC_*` values reach the browser. LiveKit secrets live on web only.

## Commands

| Command                                    | What it does                                         |
| ------------------------------------------ | ---------------------------------------------------- |
| `npm run dev`                              | web and realtime together                            |
| `npm run build`                            | Prisma client, shared, web, realtime                 |
| `npm run verify`                           | the full pipeline, must be green before a commit     |
| `npm run verify:quick`                     | copy, ui, lint, typecheck, unit tests                |
| `npm run lint:copy`                        | no emojis, no long dashes, no banned phrases         |
| `npm run lint:ui`                          | UI rules (no toasts, no native select, tokens only)  |
| `npm run lint:font`                        | Graphik glyph coverage with the Noto Sans fallback   |
| `npm run lint:graphics`                    | illustration manifest, budgets, brand exports        |
| `npm run brand`                            | rebuild logo, icons and the default share image      |
| `npm run graphics:placeholders`            | rebuild the asset manifest, prompts and placeholders |
| `npm run db:migrate`                       | migrations against the dev schema only               |
| `npm run db:seed`, `db:reset`, `db:studio` | dev schema only, through `assert-safe-db`            |

## Deployment

Two deployments only: `apps/web` on Vercel and `apps/realtime` on Render. Supabase and LiveKit are hosted services. Steps are in [wiki/Deployment.md](wiki/Deployment.md). The Render blueprint is [render.yaml](render.yaml).

## Tests

Unit tests run today. Integration, socket, browser, accessibility and responsive suites arrive from Phase 1, and `npm run verify` already has a slot for each. See [wiki/Testing.md](wiki/Testing.md).

## Launch checklist

- [ ] Supabase project created and `gistroom_dev` and `gistroom_test` schemas migrated
- [ ] Vercel and Render projects live, health checks green
- [ ] Uptime pinger on both `/health` and `/api/health`
- [ ] `gistroom.ng` DNS, `www` redirect to the apex
- [ ] Google OAuth credentials and redirect URIs
- [ ] Gmail app password, mail transport set to `smtp`
- [ ] VAPID keys generated and set on both services
- [ ] All illustrations approved (no PLACEHOLDER)
- [ ] Legal pages reviewed against the NDPA and the Cybercrimes Act
- [ ] Graphik web license confirmed (D7)
- [ ] Sitemap submitted in Search Console

## Docs

[Wiki home](wiki/Home.md), [Decisions](wiki/Decisions.md), [Security policy](SECURITY.md), [Contributing](CONTRIBUTING.md), [Changelog](CHANGELOG.md).
