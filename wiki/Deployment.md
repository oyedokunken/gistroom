# Deployment

Two deployments: `apps/web` on Vercel and `apps/realtime` on Render. These steps need your accounts, so they are yours to run.

## 1. Supabase

1. Create a project (pick the region closest to your users, for example Frankfurt or London).
2. Open Project Settings, Database, and copy the pooled connection string (port 6543) and the direct connection string (port 5432).
3. In `.env` set `DATABASE_URL` (add `?pgbouncer=true&connection_limit=1&schema=gistroom_dev`), `DIRECT_URL` (add `?schema=gistroom_dev`) and `DATABASE_SCHEMA=gistroom_dev`.
4. Run `npm run db:migrate`. The guard refuses any schema other than `gistroom_dev` or `gistroom_test`.
5. Create two storage buckets: a private `media` bucket and a public `avatars` bucket. Copy the project URL and the service role key into `.env`.

Production later gets its own Supabase project with the `public` schema, and `PRODUCTION_DB_HOST` set so dev commands refuse to touch it. Today production uses the `public` schema of the same project.

### Migrating production on every release

Neither build runs migrations. When a change adds a migration, apply it to production before you push it, or the new code reads columns that do not exist and every query on that table fails with `P2022` (this happened on 2026-10-13 with `Room.longWarnedAt`).

1. `npm run db:migrate` applies it to `gistroom_dev`.
2. `npm run db:migrate:prod` runs `prisma migrate deploy` against the `public` schema. It reads `PRODUCTION_DIRECT_URL` from `.env`, or `DIRECT_URL` with the schema switched to `public`.
3. Push. Migrations must stay additive (new nullable columns, new tables) so the running deployment keeps working between steps 2 and 3.

## 2. Vercel (web)

1. Import the GitHub repository.
2. Root directory `apps/web`, with "Include source files outside of the Root Directory" turned on.
3. Build command `npm run build` (already in `apps/web/vercel.json`).
4. Add the web variables listed in `.env.example`. Set `SKIP_ENV_VALIDATION` only if a build must run without secrets.
5. Health check: `/api/health`.

## 3. Render (realtime)

1. Create a new Blueprint from the repository. Render reads [render.yaml](../render.yaml).
2. Fill the variables marked `sync: false` in the dashboard: `DATABASE_URL` (session or direct connection), `REALTIME_PASS_SECRET`, `INTERNAL_SERVICE_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
3. `REALTIME_PASS_SECRET` and `INTERNAL_SERVICE_TOKEN` must match the values on Vercel.
4. Health check: `/health`.

Generate secrets with `node scripts/gen-secrets.mjs` and VAPID keys with `node scripts/gen-vapid.mjs`.

## 4. Keep the free tier awake

Create an UptimeRobot or cron-job.org monitor that requests `https://gistroom.ng/api/health` and `https://<your-render-host>/health` every 5 minutes. Clients also reconnect with backoff, because Render restarts too.

## 5. Domain

Point `gistroom.ng` at Vercel and add `www.gistroom.ng` as a redirect to the apex (the app also redirects `www` in `next.config.ts`). Set `ALLOWED_ORIGINS` on Render to `https://gistroom.ng`.
