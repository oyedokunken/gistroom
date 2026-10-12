# Notifications and Push

Status: Planned, Phase 2.

Web Push is what reaches someone whose tab has been closed since last night. Sockets cannot do that.

- Delivery: write the Notification row, skip push when a live focused socket exists (except calls), otherwise push to every non-revoked subscription.
- TTLs: calls 45 seconds, messages 24 hours, friend requests 7 days, Room invites 1 hour.
- Tabs: All, Unread and Activity. Activity holds receipts for what you did (started a room, invited people, archived a chat, blocked someone) with Undo where it makes sense. They never push or email and expire after 7 days.
- Room ended notices go to everyone who was in the room, in app only. Removed, banned and role changes use the room role notice and push.
- Email follows the person's own switches: room invites and room starting soon (15 minutes before) are on by default, the host's room summary and the friend request digest are opt in. Every email except security notices carries a manage preferences link.
- Never prompt for permission on first visit. Show a primer modal at a value moment.
- iOS needs the installed PWA (16.4 or newer). Android battery managers can delay push, so the missed call log and the optional email fallback always exist.
- ScheduledJob rows plus a 30 second poll and a daily Vercel sweep keep timeouts and reminders safe across Render sleeps.
