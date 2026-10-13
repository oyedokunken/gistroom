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

## The call window

A call opens in the call window (`components/call-window/call-window.tsx`), mounted once in the app shell. The window is a small state machine (`lib/call-window/machine.ts`): HIDDEN, RINGING, EXPANDED, MINIMIZED and FULLSCREEN. Geometry (drag, resize, snap, clamp) is pure code in `lib/call-window/geometry.ts` with unit tests. The call and room screens are the same screens as before. They fill the window because the window body is a transformed box, which makes it the containing block for their fixed layout, and their padding follows the window width (container queries) instead of the page width.

- Open from code with `openCall(id)` and `openRoom(slug)` in `lib/call-window/store.ts`. Both ask to leave a live call or room first (`confirmLeaveCurrent`). `startCallRequest` asks before it rings anyone.
- Close asks first when something is live, because closing leaves it.
- Size and place are saved in local storage per person (`gr_callwindow:{userId}`). Nothing depends on it.
- Full screen asks the browser to put the whole page full screen, so dialogs that render in the page body stay visible above the window. On an iPhone, where the API is missing, the window fills the page by CSS.
- A phone has no room to float: the window opens full screen, and minimizing gives a thin bar to tap, or a draggable video bubble for a video call (the same screen scaled down, so it needs no second layout).

## The ring window

One component (`components/rings/ring-host.tsx`) draws every ring, for calls and for rooms. It is mounted in the app shell, in a node that is the first child of the page body, so it is early in the tab order. The list comes from `GET /api/rings/active` (`server/rings/service.ts`): calls that are RINGING for you and not rung out, and room rings from the last 45 seconds, with `serverNow` so the countdown is right on a device with a wrong clock. The tab asks on load, on focus, when the line returns, every 3 seconds without a live socket (30 with one) and every 4 seconds while something rings. Socket events only make it quicker.

| How it ends                            | What shows                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| You answer or decline on this tab      | The card goes                                                                                                      |
| The caller cancels                     | "Missed call from {name}" for 3 seconds                                                                            |
| Answered or declined on another device | The card goes with a chip saying so                                                                                |
| 45 seconds pass                        | The card goes, the server finishes the call as missed, and the missed call is in the log and the notification list |
| Quiet hours                            | Nothing rings, the missed call is still logged                                                                     |
| You are already in a call or room      | No card, a quiet chip "{name} is calling"                                                                          |

The window state machine has a RINGING state (HIDDEN to RINGING on a ring, RINGING to EXPANDED on answer, RINGING to HIDDEN on every other way out).
