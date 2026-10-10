# Email Templates

Status: Started. Two templates and the transports are built.

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
