# Auth

Status: Built and live. Email and password, a one time code at sign up, reset and account deletion, Google sign in (switched on in production with `GOOGLE_AUTH_ENABLED=true`), database backed sessions, email verification from Settings and permanent email and username.

Email and password plus Google (D1, changed by the owner on 2026-10-10). A code is never a sign in method.

- OTP: 6 digits, HMAC hashed with a pepper, 10 minute life, 60 second resend cooldown, 5 sends per hour per email, 5 verify attempts then a 15 minute lock.
- Owner decision D38: the forms say plainly whether an email has an account. Rate limits still apply to every check.
- Session: opaque random token stored hashed, cookie `gr_session` (httpOnly, Secure, SameSite Lax), 30 day sliding expiry, Origin check on every mutating route, run by `api()` for POST, PUT, PATCH and DELETE (a route can opt out with `csrf: "none"` only if it checks its own credential; the LiveKit webhook and the sweep do, and `tests/unit/route-csrf.test.ts` lists them).
- Realtime pass: a 15 minute signed JWT from `GET /api/realtime/pass`. Cookies are never used across the two domains.
- Google (live): authorization code flow with PKCE, state and nonce, ID token verified on the server. `GOOGLE_MODE=mock` is for dev and tests and is refused in production.

## Built so far

- `apps/web/src/server/auth/otp.ts`: code generation, HMAC hashing bound to email and purpose, verify decisions (wrong, locked, expired, used), send cooldown and hourly cap.
- `apps/web/src/server/auth/tokens.ts`: session tokens, cookie attributes, sliding expiry, realtime pass (HS256, 15 minutes), origin check.
- `packages/shared/src/auth.ts`: email, code, username, name, onboarding and search schemas. Reserved usernames are in `reserved-usernames.ts`.

## Update 2026-10-10: passwords

Sign in is email and password (two steps) or Google. A one time code appears only at sign up, in forgot password and when deleting an account. Hashing: scrypt (N 2^17, r 8, p 1 since D89, old hashes upgrade at the next sign in) from Node, parameters stored in the hash so they can be raised later. Login is rate limited per email (8 per 15 minutes) and per address (30 per 15 minutes). An unknown email costs the same time as a wrong password. A sign in from a device the person has not used before creates a security notification and an email.

## Sessions (30 days, sliding)

- The session cookie is set by the server with `Max-Age` of 30 days. The proxy re-issues it on page loads, the database expiry slides at most once a day, and no session lives past 90 days.
- A token never rotates, so parallel requests and deploys cannot invalidate it. Nothing derives a secret from a build id.
- Every session end has a reason (`EXPIRED`, `REVOKED_BY_USER`, `REVOKED_ALL`, `ACCOUNT_DELETED`, `SWEPT`, `INVALID_COOKIE`, `ERROR`). Run `npm run sessions:ends` for the last 50.
- The sweep removes sessions that expired more than 7 days ago and nothing else.
- Export, setting a first password and similar actions need a sign in from the last 15 minutes.
- The installed iPhone app has its own cookies. Sign in once inside it.

## Email verification and permanent identity

Email and username cannot be changed after sign up. Settings shows both without any control, and `PATCH /api/me` answers 400 and names the field when a body contains `email` or `username`, so a crafted request or a stale form cannot believe it changed them (`rejectLockedFields`). Both stay usable for sign in, recovery and public username links.

An account whose email was never confirmed (made before codes were required, for example) sees "Your email is not verified" in Settings, Profile. `POST /api/me/email/verify/start` sends a 6 digit code with the code purpose `VERIFY_EMAIL` to the address the account already has, and `/confirm` checks it and sets `emailVerifiedAt`. The rules are the sign up rules: 10 minute expiry, 60 second resend wait, 5 sends an hour, 5 tries then a 15 minute lock, plus a per person rate limit. A verified account gets a 409 on start. Other people see only "Email verified", never the address.
