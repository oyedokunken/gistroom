# Sounds

Every sound is made in code with the Web Audio API (`apps/web/src/lib/sound/sound-manager.ts`). There are no audio files and no licences.

## Rules

- One `AudioContext`, unlocked on the first tap or key press.
- Categories: Calls (on by default), Rooms (on by default), Messages (off by default). A master volume of Low, Medium or High. The settings live on this device (Settings, Notifications, Sounds) with a Play sample button for each.
- Quiet hours silence every sound. A hidden tab stays silent except for an incoming call ring.
- Two sounds never overlap: anything inside 300 ms of the last one is dropped.
- Loops (the incoming ringtone, the outgoing ringback) stop on every exit path: answer, decline, cancel, timeout, leaving the page, and switching the category off. The ringtone vibrates on phones.

## The sounds

| Sound                     | When                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------- |
| ringtone (loop)           | an incoming call, or a room ringing you                                            |
| ringback (loop)           | the caller while it rings                                                          |
| call connected            | the other person picked up                                                         |
| call ended                | the call is over                                                                   |
| room join, room leave     | someone comes or goes, only in rooms of 12 people or fewer                         |
| room ended                | the room is over                                                                   |
| muted                     | a moderator muted you or turned off your camera                                    |
| reconnecting, reconnected | the line dropped and returned                                                      |
| message                   | a new message while Gistroom is open and you are not in that chat (off by default) |

Unit tests use a fake `AudioContext`: a disabled category stays silent, bursts are rate limited, and loops stop on every path.
