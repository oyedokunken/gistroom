# Rooms

Status: Built (Phase 5). Needs LiveKit keys for real audio and video.

Group calls created on the fly or scheduled, public or private, 32 participants, with moderators (D10).

- Private Rooms: only invited people enter. A valid expiring invite link adds the opener to the invite list (D6). Everyone else sees the not invited screen with no leaks.
- Roles: host, moderator, member. Every moderator action is written to `RoomModLog`.
- Host leaves: transfer to the longest serving moderator. An empty Room ends after 60 seconds. Rejoin grace is 120 seconds.
- Room chat is deleted when the Room ends. Reports keep their own evidence snapshot, and the room keeps only totals (peak people, messages, reactions).
- Create: a searchable topic, an Audio or Video label (anyone can still turn a camera on or off), Public or Private, optional description and schedule.
- Settings (host and moderators, live, logged): name and description, topic, language, visibility, cameras allowed, join muted, who can use chat (everyone, moderators, off), reactions, slow mode (off, 5, 15, 30 seconds), members can share the link, only moderators can unmute, lock.
- Moderation: mute audio, turn off video, remove, ban, promote, demote (host), transfer (host). The affected person sees a plain notice. Mute everyone skips the host and moderators and can keep members from unmuting.
- Publish rules are enforced in the LiveKit token and updated live with UpdateParticipant, so a member cannot bypass them from the browser.
- Reactions: ten fixed reactions defined in `packages/shared/src/reactions.ts`. They float over the sender's tile for everyone, are throttled to five every ten seconds per person, and also work on chat messages.
- Invites: friends are invited by name, each gets a Room card in their chat. Links last 1 hour, 12 hours, 1 day or 7 days, can have a maximum number of uses, show in full and revoke at once. Public room members share the plain room link unless the host turns that off. Only the host and moderators make expiring links.
- Ended rooms: a record stays. Everyone sees that it ended. People who were there see the summary, who came and their own notes. Only the host sees the moderator action count. Past rooms lists every room you hosted or attended.
- Internal QA accounts (`User.isInternal`) and their rooms are invisible to everyone else.

## Scheduled rooms and Remind me

Only the host can start a scheduled room. Everyone else sees a lobby with the host, time and topic. Remind me adds them to the member list as invited (public rooms only, private rooms use their own list), and the lobby then says they are on the list. When the host starts the room, each person on the list gets one ROOM_STARTING notice with `live: true`, in the app and as a push, and their lobby turns into a Join button. The 15 minute reminder still goes to the same people. Take me off the list removes the row again.

## Registration, reminders and schedule changes

A person registers for a scheduled room from the room page ("Remind me"). The registration is `RoomMember.registeredAt`. Registering twice does nothing, a private room only takes people who were invited, and a block in either direction stops it.

| When                         | Who                                                                            | In app                                          | Push                             | Email                                      |
| ---------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------- | ------------------------------------------ |
| Registered                   | the person                                                                     | Activity line                                   | no                               | confirmation with .ics and Add to calendar |
| Registered                   | the host                                                                       | one row per room, "Ada and 4 others registered" | no                               | no                                         |
| 15 minutes before            | registrants (not those who registered with under 15 minutes left) and the host | yes                                             | yes, high urgency, 15 minute TTL | "{title} starts in 15 minutes"             |
| Host starts it               | registrants not already inside                                                 | yes                                             | yes                              | "{title} is live now"                      |
| Time reached, not started    | the host                                                                       | "Your room is due to start now."                | yes                              | no                                         |
| 30 minutes late, not started | the list                                                                       | cancelled notice                                | no                               | registrants only                           |
| Host moves it                | registrants                                                                    | new time                                        | yes                              | new time with a fresh .ics                 |
| Host cancels it              | the list                                                                       | cancelled notice                                | no                               | registrants only                           |

Everything is idempotent through the dedupe keys `room:{roomId}:remind15:{userId}`, `room:{roomId}:live:{userId}`, `room:{roomId}:due:{hostId}`, `room:{roomId}:resched:{userId}:{time}` and `room:{roomId}:cancelled:{userId}`. `processRoomSchedule` reads the rooms, so a lost job loses nothing. The jobs (`room-remind`, `room-due`, `room-noshow`) only wake the web sweep through the realtime scheduler. The daily Vercel cron is the last net.

## Rooms in the call window

A plain click on a room anywhere (Discover, the room list, search, an invite card in a chat, a new room) opens it in the call window and leaves the page alone (`RoomLink`, `openRoom`). A modified click or a new tab goes to `/app/rooms/{slug}`, which opens the window over a quiet details page (`RoomEntry`). A room that has ended, a private room you are not in, or a bad link has no call to float, so it keeps its own page there.

## Rooms that ring you

A host or moderator rings an invited person from the People panel. The ringed person sees the same card as for a call (see wiki/Calls.md), with the room title, topic, language, Audio or Video, a lock mark, the host, who is inside and the three buttons Join, Decline and Don't ring me for this room. The card reads the room each time the list is fetched, so it says "This room is full", "This room is locked right now" or "This room has ended" and turns Join off. Joining on one device closes the card on the others (`ring:answered_elsewhere`).
