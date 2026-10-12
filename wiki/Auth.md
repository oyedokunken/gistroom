# Auth

Status: Started. The pure logic is built and unit tested. Routes and database writes wait for the Supabase project.

Passwordless by default (D1): email OTP and Google OAuth, database backed sessions, no passwords.

- OTP: 6 digits, HMAC hashed with a pepper, 10 minute life, 60 second resend cooldown, 5 sends per hour per email, 5 verify attempts then a 15 minute lock.
- Responses never reveal whether an email already has an account.
- Session: opaque random token stored hashed, cookie `gr_session` (httpOnly, Secure, SameSite Lax), 30 day sliding expiry, Origin check on every mutating route.
- Realtime pass: a 15 minute signed JWT from `GET /api/realtime/pass`. Cookies are never used across the two domains.
- Google: authorization code flow with PKCE, state and nonce, ID token verified on the server. `GOOGLE_MODE=mock` is for dev and tests and is refused in production.

## Built so far

- `apps/web/src/server/auth/otp.ts`: code generation, HMAC hashing bound to email and purpose, verify decisions (wrong, locked, expired, used), send cooldown and hourly cap.
- `apps/web/src/server/auth/tokens.ts`: session tokens, cookie attributes, sliding expiry, realtime pass (HS256, 15 minutes), origin check.
- `packages/shared/src/auth.ts`: email, code, username, name, onboarding and search schemas. Reserved usernames are in `reserved-usernames.ts`.

## Update 2026-10-10: passwords

Sign in is email and password (two steps) or Google. A one time code appears only at sign up, in forgot password and when deleting an account. Hashing: scrypt (N 16384, r 8, p 1) from Node, parameters stored in the hash so they can be raised later. Login is rate limited per email (8 per 15 minutes) and per address (30 per 15 minutes). An unknown email costs the same time as a wrong password. A sign in from a device the person has not used before creates a security notification and an email.

## Sessions (30 days, sliding)

- The session cookie is set by the server with `Max-Age` of 30 days. The proxy re-issues it on page loads, the database expiry slides at most once a day, and no session lives past 90 days.
- A token never rotates, so parallel requests and deploys cannot invalidate it. Nothing derives a secret from a build id.
- Every session end has a reason (`EXPIRED`, `REVOKED_BY_USER`, `REVOKED_ALL`, `ACCOUNT_DELETED`, `SWEPT`, `INVALID_COOKIE`, `ERROR`). Run `npm run sessions:ends` for the last 50.
- The sweep removes sessions that expired more than 7 days ago and nothing else.
- Export, setting a first password and similar actions need a sign in from the last 15 minutes.
- The installed iPhone app has its own cookies. Sign in once inside it.
