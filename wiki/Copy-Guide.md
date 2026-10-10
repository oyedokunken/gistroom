# Copy guide

Voice rules live in CLAUDE.md Section 18. In short: plain Nigerian English, warm, short sentences, sentence case, active voice.

- Slang is seasoning: at most one phrase per screen, only in low stakes moments.
- No slang in legal text, security messages, OTP emails, deletion or export confirmations, account or data errors, or moderation messages.
- Errors say what happened and what to do next. They do not apologize.
- Strings live in `apps/web/src/content/` (R10). Components import them.
- `npm run lint:copy` blocks emojis, long dashes and a list of filler phrases (`scripts/banned-phrases.json`).

The microcopy bank is `apps/web/src/content/microcopy.ts`. Landing and footer strings are in `content/landing.ts`.
