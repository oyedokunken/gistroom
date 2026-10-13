# Contributing

CLAUDE.md is the source of truth. Read it before you write code.

## Setup

```bash
npm install
cp .env.example .env
node scripts/gen-secrets.mjs
npm run dev
```

On Windows PowerShell use `Copy-Item .env.example .env`. Every script runs on Windows, macOS and Linux.

## The rules that trip people up

These are rules R1 to R24 from Section 2 of CLAUDE.md. The checkers enforce most of them.

- No emojis and no long dashes (em, en, bar, figure) anywhere in source, copy, docs or commit messages. Use a comma, colon, full stop or hyphen.
- Icons come from `lucide-react`. No toasts: use inline field errors and `useFeedback()` modals.
- Validation is Zod with React Hook Form. Forms have `noValidate` and inputs have no HTML validation attributes.
- No native `<select>`: use `Select`.
- User facing strings live in `apps/web/src/content/`.
- Colors, radii and fonts come from tokens. No raw hex outside `tokens.ts` and `globals.css`.
- No `console.log`, no `any`.

## Checks

```bash
npm run verify:changed # only what your changes touch, compared with origin/main
npm run verify:quick   # copy, ui, lint, typecheck, unit tests
npm run verify         # everything, must be green before you push
```

Husky runs the quick checks on commit and push.

## Commits

One plain sentence in the imperative mood, for example `Add friend request cooldown`. No prefixes, no emojis, no dashes, no co-author trailers. Never commit with a failing verify.

## Pull request checklist

- [ ] `npm run verify` is green
- [ ] New behavior has tests at the right level
- [ ] Strings are in `content/`, icons are Lucide, tokens are used
- [ ] Empty, loading, error and offline states exist
- [ ] Docs, wiki and CHANGELOG are updated
- [ ] Screenshots at 360, 768 and 1440 for any UI change
- [ ] A new dependency has a one line reason and is maintained
- [ ] A new migration is applied to production with `npm run db:migrate:prod` before the push that ships it (builds never migrate, so the deployed code would read columns that do not exist)
