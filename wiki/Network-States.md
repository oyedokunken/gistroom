# Network states

How Gistroom behaves when the line is good, weak, gone or coming back. The code is in `apps/web/src/lib/session/` and `apps/web/src/components/session/`.

## The monitor

`useConnection()` returns `{ state, since, lastOnlineAt, rttMs, realtime, livekit }`. The state is one of ONLINE, WEAK, OFFLINE, RECONNECTING and RECOVERED.

- `navigator.onLine` is one input only. A `HEAD /api/health` runs every 10 seconds while the app is visible and every 30 seconds when hidden, with a 4 second timeout. A health check that fails while the browser says online (a captive portal, Wi-Fi with no data) means OFFLINE. A health check that answers with a server error means the device is fine and Gistroom is not.
- WEAK: three round trips in a row over 1.5 seconds, a very slow network type, or LiveKit reporting poor quality.
- Debounce: a change to a worse state must hold for 3 seconds, a return must hold for 2. RECOVERED lasts 3 seconds.
- The realtime service may be asleep. If only the socket is down while the API is up, the bar says "Connecting to chat..." for 20 seconds and then "Taking longer than usual". Chat still sends over plain requests, and joining calls and rooms never depends on the realtime service.

## What people see

| Condition                                     | Where                                              | What                                                                                                         |
| --------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Offline outside a call                        | bar under the header (above the tab bar on phones) | "You're offline. Messages will send when you're back." Then "Back online" for 3 seconds                      |
| Offline in a call or room                     | dialog `net-offline`                               | "You're offline", live counter, Leave. After 60 seconds it becomes `net-disconnected`                        |
| LiveKit reconnecting over 3 seconds           | dialog `net-reconnecting`                          | closes by itself with a "You're back" chip                                                                   |
| Dropped for good                              | dialog `net-disconnected`                          | Rejoin (keeps seat and role inside 120 seconds) or Leave                                                     |
| Could not connect                             | dialog `net-cant-connect`                          | Try again or Close                                                                                           |
| Network type changed                          | banner                                             | "Switching networks", only a dialog if the reconnect drags on                                                |
| The other person lost for 5 seconds           | dialog `net-peer-lost`                             | "Waiting for {name} to reconnect" with a counter, Hang up. After 60 seconds the call ends (`peer-gone`)      |
| Weak for 10 seconds                           | banner                                             | "Switch to audio only". Incoming video drops to its smallest size. `NETWORK_WEAK_AS_MODAL` makes it a dialog |
| Our server unreachable while online           | dialog `net-server`                                | "We can't reach Gistroom right now"                                                                          |
| 401 during a call or room                     | dialog `session-expired`                           | Sign in (comes back to the call or room) or Leave                                                            |
| Joined from another device                    | dialog `duplicate-session`                         | on the older device                                                                                          |
| Browser blocked remote audio                  | dialog `audio-blocked`                             | "Tap to hear everyone"                                                                                       |
| Microphone or camera blocked, missing or busy | dialogs `mic-blocked`, `cam-blocked`               | steps for the browser in use, Try again                                                                      |
| Headset changed                               | banner                                             | "Switched to {device}"                                                                                       |
| In app browser                                | dialog `unsupported-browser`                       | Copy link, Open in browser                                                                                   |
| Phone paused the mic in the background        | dialog `tab-backgrounded`                          | Unmute                                                                                                       |

Only one dialog is open at a time. The order from most to least urgent: removed or banned, ended, disconnected, blocked, offline, information. A dialog for the same cause is never opened twice, and each one closes by itself when the cause clears.

Every dialog that appears is logged on the server as `session modal shown` with its reason code (once a minute per code).

## Chat and outgoing things

- Messages go to the outbox at once with a clock. Failed ones say "Not sent" with Retry and Delete. Uploads wait for the line ("Waiting for a connection") and start again from the beginning when it returns.
- Starting a call, creating a room, sending a friend request and uploading are turned off while offline, with the tooltip "Needs a connection".
- The `/offline` page has art, "You're offline" and a Try again button.
