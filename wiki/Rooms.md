# Rooms

Status: Built (Phase 5). Needs LiveKit keys for real audio and video.

Group calls created on the fly or scheduled, public or private, 32 participants, with moderators (D10).

- Private Rooms: only invited people enter. A valid expiring invite link adds the opener to the invite list (D6). Everyone else sees the not invited screen with no leaks.
- Roles: host, moderator, member. Every moderator action is written to `RoomModLog`.
- Host leaves: transfer to the longest serving moderator. An empty Room ends after 60 seconds. Rejoin grace is 120 seconds.
- Room chat is kept 24 hours after the Room ends, only for reports.
