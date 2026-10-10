# Architecture

Diagrams are in the [README](../README.md#architecture). This page records the rules behind them.

## Responsibilities

- Postgres is the source of truth. Socket events are hints. After any reconnect, clients refetch what they missed by cursor.
- Web (Vercel) owns auth, sessions, REST, authorization decisions, LiveKit tokens and webhooks, signed upload and download URLs, and all email.
- Realtime (Render) owns sockets, presence, typing, receipts fan-out, notification fan-out, Web Push sending, call ring timeouts and schedulers. It never talks to LiveKit.
- Web tells realtime about events with `POST {REALTIME}/internal/events`. Realtime asks web to send email with `POST {WEB}/api/internal/email/send`. Both use the `INTERNAL_SERVICE_TOKEN` bearer token and the shared Zod schemas.

## Layout rules

- `packages/shared` is the contract between web and realtime. Web never imports from `apps/realtime` and the reverse.
- `server/` folders are never imported by client code (ESLint `no-restricted-imports`).
- Joining a call or Room must work with Vercel and LiveKit alone, because the free Render instance sleeps.

## Built so far

Monorepo, Prisma baseline schema, health endpoints on both services, the realtime server skeleton with the heartbeat settings from Section 8, and the landing shell. No socket handlers yet.
