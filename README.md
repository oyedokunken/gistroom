# Gistroom

Live talk about Nigeria, in Nigeria. Friends, chats, calls and Rooms, audio first, built for Nigerian data.

Status: Phase 0 (foundation). The full spec is in [CLAUDE.md](CLAUDE.md).

## Quick start

```bash
npm install
cp .env.example .env
node scripts/gen-secrets.mjs
npm run dev
```

Web runs on port 3000 and the realtime service on port 4000.

## Commands

| Command                | What it does                                     |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | web and realtime together                        |
| `npm run verify`       | the full pipeline, must be green before a commit |
| `npm run verify:quick` | copy, ui, lint, typecheck, unit tests            |
| `npm run db:migrate`   | migrations against the dev schema only           |

## Layout

See Section 4 of CLAUDE.md. Long-form docs live in [wiki](wiki/Decisions.md).
