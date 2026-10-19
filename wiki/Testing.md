# Testing

Plan and expectations: CLAUDE.md Section 21.

## Suites

| Suite                                          | Needs a database      | What it covers                                                                                                                   |
| ---------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `test:unit` (Vitest)                           | no                    | schemas, rules, state machines, tokens, password cost, route CSRF coverage, storage guard, migration logic, copy and UI checkers |
| `test:integration` (Vitest)                    | yes                   | auth, sessions, account, friends, search, push, rooms, rings, registration, reliability, media access, rate limits               |
| `test:socket` (Vitest)                         | no                    | Socket.IO delivery, presence and room events against a fake store                                                                |
| `test:browser`, `test:a11y`, `test:responsive` | yes (signed in specs) | Playwright flows, axe scans and layout audits                                                                                    |
| `test:coverage`                                | yes                   | unit, integration and socket together with v8 coverage and enforced floors (D90)                                                 |

Database suites use `TEST_DATABASE_URL` and `DATABASE_SCHEMA=gistroom_test`. Locally they use the hosted test schema from `.env` and skip when it is missing. In CI a missing database throws (see wiki/CI.md).

## Rules

- Tests live in `tests/`. Shared helpers go in `tests/helpers`.
- Test data uses the `e2e_` or `test_` prefix, cleans up after itself and only touches the `gistroom_test` schema.
- Emoji in tests are written as escapes, for example `"\u{1F600}"`.
- Strings that the copy checker forbids are built from fragments in tests, so the test files stay clean.
- UI checks that need a real browser are done with Playwright, not by reading markup.
- Rate limits count in fixed windows. A test that expects the Nth call in a window to be refused calls `waitForWindowRoom` first, so a window edge cannot make it fail by chance.

## Targeted runs

`npm run verify:changed` compares your work with `origin/main` (or `--base <ref>`) and runs only the matching checks: copy and UI rules, ESLint and Prettier on the changed files, typecheck when TypeScript changed, Vitest with `--changed` for unit, integration and socket tests, and the Playwright specs that map to the changed areas (the map lives in `scripts/verify-changed.mjs`). Add `--no-browser` to skip Playwright. The full `npm run verify` still runs in CI and before a release, and CI is the final word.

- Browser tests run with two workers and one retry (`playwright.config.ts`). They share one hosted database and one server, and more workers made slow pages time out under load with nothing wrong. A retry that passes shows as flaky in the list.
