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
