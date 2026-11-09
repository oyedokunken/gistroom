# Realtime

Status: Built. Socket.IO service with presence, typing, receipts, notification fan-out, Web Push sending, call and room events, ring and reminder scheduling, and screen sharing hints.

Event names and Zod payloads live in `packages/shared/src/events.ts` (not written yet).

- Every event handler authorizes the action on its own (R16).
- Per-socket token bucket: 30 events per second burst, 5 per second for typing.
- Heartbeat: ping interval 20 seconds, ping timeout 20 seconds. Transports: websocket first, polling fallback.
- Connection state recovery is on for short drops, but the REST resync by cursor is the guarantee.
- Single instance with in-memory presence. Scaling out needs the Socket.IO Redis adapter.

## Presentation hints

`presentation:changed` carries `{ scope: "call" | "room", ref, change }` where `ref` is the call id or the room slug and `change` is one of `started`, `stopped`, `requested`, `handed`, `denied`, `force-ended`. Web sends the internal event `presentation` (scope, id, change) and realtime delivers it only to the two people of a call or the people joined to a room. It never carries a source name, a title or any pixels.
