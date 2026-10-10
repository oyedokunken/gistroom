# Email Templates

Status: Planned, Phase 1.

Email is sent only from the web app through Nodemailer.

- Transports: `console` (dev default), `capture` (tests), `smtp` (needs `MAIL_ENABLE_REAL=true`). Outside production the recipient must be on `MAIL_ALLOWED_DOMAINS`.
- OTP and security emails are never queued for later. They fail loudly.
- Templates are table based, 600 pixels wide, with a plain text alternative and the system font stack.
- `npm run mail:preview` renders every template to `.mail-preview/`.
