# Auth

Status: Planned, Phase 1.

Passwordless by default (D1): email OTP and Google OAuth, database backed sessions, no passwords.

- OTP: 6 digits, HMAC hashed with a pepper, 10 minute life, 60 second resend cooldown, 5 sends per hour per email, 5 verify attempts then a 15 minute lock.
- Responses never reveal whether an email already has an account.
- Session: opaque random token stored hashed, cookie `gr_session` (httpOnly, Secure, SameSite Lax), 30 day sliding expiry, Origin check on every mutating route.
- Realtime pass: a 15 minute signed JWT from `GET /api/realtime/pass`. Cookies are never used across the two domains.
- Google: authorization code flow with PKCE, state and nonce, ID token verified on the server. `GOOGLE_MODE=mock` is for dev and tests and is refused in production.
