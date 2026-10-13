# Call and room edge cases

What was checked against WhatsApp, Zoom and Meet behaviour, and what the code does. Each line names where it is tested.

## Calls

- Missed, declined, busy and cancelled calls each write the right call log entry for both people (`calls` tests).
- Durations come from server timestamps (`answeredAt` and `endedAt`), never the browser clock.
- Calling yourself, a non friend or someone who blocked you is refused on the server, and the caller only sees "{name} is unavailable".
- A person with no alerts on who has not been seen for 2 minutes: the caller is told "may not see this right away" and can keep calling.
- Pressing Call twice quickly keeps one call (`live-reliability` integration test).
- Callee already on a call, or in a live room: the caller sees "is busy", the callee gets a missed call entry and a quiet chip, not a ring.
- A block or an unfriend ends an active call with the neutral "This call has ended".
- A side silent for 60 seconds ends the call (`peer-gone`). The heartbeat is every 8 seconds.
- Who ended it is stored (`endedById`), so each side reads the right outcome.

## Rooms

- The last seat: two people asking at once, exactly one gets it. Seats are counted in the order people came in and the one past the limit steps out.
- An invite link with one use: the database claims the use atomically, so one of two people at once gets in.
- Remove: 10 minute wait on every way in, links and forwarded invites included. Ban: never. Their chat comes off the screen.
- Host dropped: everyone sees "Host is reconnecting". After the 120 second grace the room passes to the longest serving moderator, then the longest present person.
- Host leaves on purpose: the room passes on at once.
- A room nobody is connected to for 5 minutes ends. LiveKit is asked who is connected, and the database is made to match it. Rooms end after 8 hours, with a warning at 7 hours 45 minutes.
- A scheduled room whose host never came is cancelled after 30 minutes and the people on its list are told.
- Late joiners do not see chat from before they came.
- Settings changed by two moderators at the same time: the last write wins and both are logged.
- Reaction and chat floods are rate limited (60 reactions per 10 seconds, 30 chat messages per minute).

## Chat

- Delete and edit are refused after 15 minutes by the server, whatever the browser clock says.
- A chat with someone who blocked you or deleted their account says "You can't send messages to this person" and never says why.
- Read receipts go out only when the thread is open and the tab is focused. A typing indicator ends after 5 seconds.

## Lifecycle

- Leaving a call or room, an error, or a route change never leaves a track, timer, socket, audio context or listener behind. A unit test joins and leaves 20 times with a fake LiveKit and checks that every track was stopped and no listener or timer remains.
- LiveKit tokens last 9 hours for rooms (the longest room plus an hour) and 6 hours for calls, so a reconnect late in a long session still works.
- Every status that matters is written by the server and reconciled by the sweep, so a crashed tab cannot leave a call or room stuck.
