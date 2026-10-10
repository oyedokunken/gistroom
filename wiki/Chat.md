# Chat

Status: Planned, Phases 2 and 3.

DMs only, between accepted friends with no block in either direction.

- Messages are idempotent on `clientId`. Sends are optimistic and queue in IndexedDB when offline.
- Delete for me, delete for everyone (60 minute window, D4), archive stays archived (D3), star, react, reply.
- Media is private, validated by magic bytes, EXIF stripped, served through short lived signed URLs (R15).
- Voice notes: MediaRecorder, 5 minute cap, 64 bar waveform, 1x, 1.5x and 2x playback.
