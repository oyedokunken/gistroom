# Safety and Moderation

Status: Planned, Phases 5 and 7.

Block, report, moderators, private Rooms and rate limits.

- A block ends the friendship, hides both people from search and prevents requests, DMs, calls and Room invites.
- Reports capture evidence (the last 20 messages for a message report).
- Admin console: report queue, user lookup, suspend and ban, live Rooms, audit log and metrics.
- Takedown contact: safety@gistroom.ng.

## Badges and moderation

Moderation can revoke a badge. The grant row stays with who revoked it and when, an `AuditLog` entry `badge.revoke` is written, the public summary is refreshed, and the same ordinal is never granted again. `revokeBadge` in `apps/web/src/server/badges.ts` is the one function for it, ready for the admin console in Phase 7. Helpful host stops earning while a report against the host or their rooms is open. Trusted reporter is private. A person can hide badges from public surfaces without losing them.

Room moderators and the host can stop a presentation in a room. It is logged as `PRESENT_STOP` and never carries a source name. See wiki/Rooms.md.
