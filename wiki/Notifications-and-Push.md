# Notifications and Push

Status: Built. In app list with search and paging, Web Push with a service worker, quiet hours, per type switches, a delivery trail and retry, room reminders and a come back notice.

Web Push is what reaches someone whose tab has been closed since last night. Sockets cannot do that.

- Delivery: write the Notification row, skip push when a live focused socket exists (except calls), otherwise push to every non-revoked subscription.
- TTLs: calls 45 seconds, messages 24 hours, friend requests 7 days, Room invites 1 hour.
- Push is independent of the session. A subscription belongs to a person and a device. After a session ends, the device keeps getting plain alerts for 30 days with no names. See CLAUDE.md section 10.3b and the QA runbook section 11.
- Tabs: All, Unread and Activity. Activity holds receipts for what you did (started a room, invited people, archived a chat, blocked someone) with Undo where it makes sense. They never push or email and expire after 7 days.
- Room ended notices go to everyone who was in the room, in app only. Removed, banned and role changes use the room role notice and push.
- Email follows the person's own switches: room invites and room starting soon (15 minutes before) are on by default, the host's room summary and the friend request digest are opt in. Every email except security notices carries a manage preferences link.
- Never prompt for permission on first visit. Show a primer modal at a value moment.
- iOS needs the installed PWA (16.4 or newer). Android battery managers can delay push, so the missed call log and the optional email fallback always exist.
- ScheduledJob rows plus a 30 second poll and a daily Vercel sweep keep timeouts and reminders safe across Render sleeps.

## The notifications page

- At 768 px and wider the page is two columns: the list (about 340 to 400 px) and the detail. Nothing opens by itself. The selection is the `n` query value, so refresh and back work, and the opened item is marked read after one second.
- The detail comes from `GET /api/notifications/[id]`, which returns the notification and what is true now (friend request status, room status). A deleted notification is a 404 shown as "This is no longer available", never an error screen.
- Below 768 px the list is one column and the detail is a modal.

## Diagnosing a missing notification

Every notification leaves a trail in `NotificationDelivery` (also at `GET /api/notifications/deliveries` for the signed in person). The stages are CREATED (web wrote the row), CLAIMED (realtime took the job), SOCKET_SENT (a live tab got it), PUSH_SENT, PUSH_REJECTED (with the push service status code), PUSH_SKIPPED (with a reason), RETRY and DROPPED. Records hold reasons only, never message text, and are kept for 30 days.

Read the trail from the top:

1. No CREATED row: the event never reached `notify()`. Check notification preferences (in app switch) and that the account is ACTIVE.
2. CREATED but no CLAIMED: the realtime service did not run the job. Check `ScheduledJob` for the notification (processedAt empty means waiting, attempts and lastError show failures). The web sweep and the 30 second poll both pick it up, and a failed run is put back with a growing wait and dropped after five attempts.
3. PUSH_SKIPPED with `focused-socket`: a focused tab got it in the app. `push-off-or-quiet-hours`: the person turned push off for that type or quiet hours were on (quiet hours hold back push and email only, never the in app row). `no-active-device`: no subscription, or the device was signed out for more than 30 days. `push-not-configured`: VAPID keys are missing on realtime.
4. PUSH_REJECTED with 404 or 410: the browser dropped the subscription. The row is revoked and the person resubscribes on the next signed in load. Other codes count toward the three failure rule that marks a device unhealthy.

## One time notices stay one time

A notice with a dedupe key (a 15 minute reminder, a live now notice, a moved or cancelled notice) is sent once per person. Reading it does not free the key, and deleting the row does not either: the CREATED delivery record is the tombstone, so a later sweep cannot send it again. Only rows that merge on purpose (DM_MESSAGE and ROOM_REGISTRATIONS) give up their key when read. The 15 minute reminder key includes the start time, so a rescheduled room reminds again for the new time.

## Room reminders

A registered person can switch the 15 minute and live now reminders off for one room (`reminders-off`). Moved and cancelled notices still arrive, because they change what the person has planned. The host always gets the 15 minute reminder and the due now notice. The room page shows the next reminder time. The reminder survives a sleeping realtime service because the sweep reads the rooms, not the jobs, and the daily Vercel cron runs the same sweep.

## Search and paging on the notifications page

- `GET /api/notifications` takes `tab` (all or activity), `unread=1`, `q`, `cursor` and `limit` (1 to 50, default 20), validated by `notificationListQuerySchema` in `packages/shared`. The order is `createdAt` then `id`, newest first, and the cursor is the last row of the page. There is no offset.
- `q` is trimmed, spaces are collapsed and it is cut at 60 characters. One character is refused, two or more search. It matches case insensitively inside the person own rows only: a short list of payload keys (names, usernames, room title, message preview, title, body, text, device) plus the types whose label contains the text, so "missed call" finds missed calls. Ids, links and counts are never matched. The room registration row stores its names in a list and is not searched by name.
- The page keeps the text in the address (`?q=`), waits 300 ms after typing, cancels a request that a newer search made stale, and shows loading, no results, error with Try again and an end of list line. Reading, deleting and clearing refresh the same cached pages, so the search stays and the unread count follows. Index: `Notification(userId, createdAt desc, id desc)`.
- The decision is D109.

## Come back nudges

- A person with no meaningful action and no session for more than seven days gets one in app notice (type `REENGAGE`, opens Discover) and one email (`come-back`), at most once in 30 days and three times in 365 days. Both are sent by the daily sweep in the Lagos daytime, 200 people per run at most. See D105 to D108.
- Settings, Notifications has a switch for it ("Reminders when you have been away") with separate In the app and Email choices. It never pushes. Quiet hours hold the email. Seed, internal, suspended, deleted and unverified accounts are never selected, and a switched off email is final for that spell.
- `ReengagementNotice` has one row per person, spell and channel, which is what makes a retry or a second sweep safe. A spell is the UTC day of the last sign of life.
