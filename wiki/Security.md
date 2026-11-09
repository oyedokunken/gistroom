# Security

Policy: [SECURITY.md](../SECURITY.md). Rules: CLAUDE.md Section 20.

## Built

- Nonce based Content Security Policy and static headers from `apps/web/src/proxy.ts` (builder in `lib/security-headers.ts`, unit tested). Pages render per request so every script carries the nonce.
- Third party style tags that cannot take a nonce are allowed by exact hash, checked by a test (Decisions D22).
- `/api/csp-report` accepts and drops reports, rate limited per instance.
- Realtime service: CORS allow list from `ALLOWED_ORIGINS`, no wildcard, no credentials. Log redaction for authorization, cookies, tokens and emails.
- `assert-safe-db` refuses destructive database commands outside `gistroom_dev` and `gistroom_test`.
- Secrets are git-ignored and validated at boot. Only `NEXT_PUBLIC_*` reaches the browser.

## Planned

Sessions, OTP, rate limits, per-event socket authorization, media validation and signed URLs arrive in Phases 1 to 3.

## Added in November 2026

- Avatar commit is idempotent, refuses another person's or a replaced upload, and removes the old file only after the new one is saved.
- Forwarded files are copied to a path in the destination chat, so media access is always checked against the chat that holds the file.
- Related rooms and room lists use one authorization query. A room you cannot see answers an empty list, never a different error.
- Notification delivery records hold reasons only. The notification search always puts the person's own id first in the query, so another person's rows cannot be reached.
- Screen sharing: the LiveKit screen share source is granted by the server only to the one presenter and revoked on stop, leave, removal, ban or end. Nothing on the shared screen or its name is stored, logged or sent.
- Public profiles never include an email address. Email and username are refused on update.
