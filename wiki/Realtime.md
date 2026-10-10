# Realtime

Status: Skeleton only. Handlers arrive in Phase 2.

Event names and Zod payloads live in `packages/shared/src/events.ts` (not written yet).

- Every event handler authorizes the action on its own (R16).
- Per-socket token bucket: 30 events per second burst, 5 per second for typing.
- Heartbeat: ping interval 20 seconds, ping timeout 20 seconds. Transports: websocket first, polling fallback.
- Connection state recovery is on for short drops, but the REST resync by cursor is the guarantee.
- Single instance with in-memory presence. Scaling out needs the Socket.IO Redis adapter.
