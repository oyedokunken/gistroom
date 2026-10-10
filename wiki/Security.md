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
