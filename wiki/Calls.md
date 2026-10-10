# Calls

Status: Built (Phase 4). Needs LiveKit keys in `.env` to carry real audio and video.

1:1 audio and video on LiveKit. Switching media toggles the camera track in the same room, with no reconnect.

## Flow

1. The caller opens a chat and taps the phone or video button. A confirm modal names the person and the kind of call.
2. `POST /api/calls` checks friendship, blocks and that the callee is active. It creates a `Call` as RINGING with a 45 second ring, writes a `ScheduledJob` for the timeout and tells realtime. The caller gets a LiveKit token at once and connects while it rings.
3. Realtime sends `call:incoming` to every open tab of the callee and a `CALL_INCOMING` push with a 45 second TTL, always, even with a tab open.
4. The callee answers (`/accept`), declines (`/decline`), or does nothing. The caller can cancel (`/cancel`). Either person can end an active call (`/end`).
5. Finishing a call writes a `CallLogEntry` for both people exactly once. A call the callee did not answer also adds a quiet in-app missed call notification (no second push, the cancel push already left a missed call line).

## State machine

`packages/shared/src/calls.ts` holds the pure rules, unit tested in `tests/unit/calls.test.ts`.

| From    | Action  | Who          | To        |
| ------- | ------- | ------------ | --------- |
| RINGING | ACCEPT  | callee       | ACTIVE    |
| RINGING | DECLINE | callee       | DECLINED  |
| RINGING | CANCEL  | caller       | CANCELLED |
| RINGING | TIMEOUT | anyone, late | MISSED    |
| ACTIVE  | END     | either       | ENDED     |

An answer that arrives after the ring ran out becomes MISSED.

## Glare and busy

- If A calls B while B is already ringing A, the new call is not created. A answers B's call instead.
- If the callee is in an active call, the call is stored as BUSY. The caller sees "On another call" and the callee gets a missed call entry.

## Timeouts

- The caller and callee screens call `/timeout` when the ring ends.
- The realtime scheduler claims the `call-timeout` job and asks the web app to run `/api/internal/jobs/sweep`.
- The daily Vercel cron calls the same sweep as a last safety net. It is idempotent.

## LiveKit

Tokens are HS256 JWTs signed in `apps/web/src/server/livekit.ts` with the API secret, so no server SDK is needed to let people join. The secret stays on the web app. The browser only receives a token that is valid for one room.

## Client

- `IncomingCall` rings on every signed in screen with `role="alertdialog"` and a short two tone ring made with Web Audio.
- `/app/call/[id]` is the full screen call: mute, camera, flip camera, end, timer, wake lock, weak connection banner after 10 seconds (switch to audio only), and plain modals when the microphone or camera is blocked.
- Data saver starts the call with audio only and holds video at 360p.
- `/app/calls` is the call log with filters, name search, cursor pagination and a page size selector.

## Decisions

- Answering on one device clears the ring everywhere through the `call:accepted` event and a `CALL_CANCEL` push with `reason: dismiss`. A separate `call:answered_elsewhere` event is not needed.
- Pre call device check: the first time the microphone or camera is refused, a modal explains how to allow it. A separate check screen is not built yet.
