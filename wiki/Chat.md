# Chat

Status: Built (Phases 2 and 3): text, receipts, typing, presence, replies, edit, delete, stars, reactions, archive, voice notes, photos, video, files, forwarding, offline queue.

DMs only, between accepted friends with no block in either direction.

- Messages are idempotent on `clientId`. Sends are optimistic and queue in IndexedDB when offline.
- Delete for me, delete for everyone (60 minute window, D4), archive stays archived (D3), star, react, reply.
- Media is private, validated by magic bytes, EXIF stripped, served through short lived signed URLs (R15).
- Voice notes: MediaRecorder, 5 minute cap, 64 bar waveform, 1x, 1.5x and 2x playback.

## Forwarding messages

A person forwards one message from its menu (Forward) or several with Select, up to 10 messages to up to 5 friends in one go. The destination picker lists recent chats first, then all friends, with a search box. `POST /api/messages/forward` takes `batchId`, `messageIds` and `userIds` and nothing else, so labels and senders can never come from the client.

Rules, each tested:

- Forwardable types are text, images, videos, voice notes and files. Room invites, call records and system lines stay in their chat. A message deleted for everyone, hidden by the person (delete for me), or from before they cleared the chat is left out and counted in `skipped`. A message from a chat the person is not in answers like a missing one.
- The destination must be an accepted friend with no block in either direction, the same rule as any send. One failed destination does not stop the others, and the result says which one failed.
- Every copy is a new message from the forwarder, sent now, with a client id derived from the batch id, the destination and the message position. A retry of the same request finds the first copy instead of making a second one, and does not copy files again.
- The copy has `meta.forwarded = true` and `meta.forwardedFrom` (the source type). It never carries the original sender or time, and a forward of a forward reads the same, so there is no chain of senders (decision D94).
- Files are copied inside the private bucket to `dm/{destinationConversationId}/{forwarderId}/{uuid}` and get their own `MessageAttachment` and `FileAsset` rows. Media access is then checked against the destination chat like any other file, and deleting the original or the original sender's account does not break the copy.
- Rate limits: 10 forward requests a minute, and each copy still counts toward the 60 messages a minute limit.

## Voice note player and back button

The voice note player takes every colour from `voice-styles.ts` (rest, hover, focus-visible and disabled for both bubble colours), and `tests/unit/voice-contrast.test.ts` reads the design tokens and checks each pair against WCAG AA in light and dark. On a phone the chat header has a 44 pixel Back to chats button before the avatar. Drafts are kept per conversation, so going back and returning keeps what was typed.
