# Email Templates

Status: Built. The template registry covers sign up and reset codes, security notices, friends, rooms (registration, reminders, live now, moved, cancelled, summary), calls, data export, account deletion, reports, contact, the digest and the come back email. Preview them with `npm run mail:preview`.

Email is sent only from the web app through Nodemailer.

- Transports: `console` (dev default), `capture` (tests), `smtp` (needs `MAIL_ENABLE_REAL=true`). Outside production the recipient must be on `MAIL_ALLOWED_DOMAINS`.
- OTP and security emails are never queued for later. They fail loudly.
- Templates are table based, 600 pixels wide, with a plain text alternative and the system font stack.
- `npm run mail:preview` renders every template to `.mail-preview/`.

## Built so far

- Templates: `verify-otp` and `login-otp`, in `apps/web/src/server/mail/templates.ts`. Every template has a Zod props schema, sample props and a plain text alternative.
- Transports: `console`, `capture` (writes to `.mail-capture/`) and `smtp` (Gmail). Production only accepts `smtp`.
- Inline styles use single quoted font names. A test checks every style attribute is well formed, because a double quote there breaks the whole email.
- The support address in the footer is support@gistroom.ng (assumed, see Decisions D26).

## come-back

Sent by the sweep to people who have been away for more than seven days. Props: `to` (full name, the greeting uses the first name) and `path` (always `/app/discover`). It states no counts, names or rooms, links to the live rooms, says it comes at most once a month and carries the manage preferences link (`/app/settings/notifications`), where the Reminders when you have been away switch turns it off. It follows the person email switch and quiet hours, is never sent to seed, internal, suspended or unverified accounts, and respects `MAIL_ALLOWED_DOMAINS` outside production. It has no times, so no zone rule applies.
