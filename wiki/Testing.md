# Testing

Plan and expectations: CLAUDE.md Section 21.

## Today

| Suite                                          | State                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `test:unit` (Vitest)                           | Running. Copy checker, UI rules checker, limits, safe database guard, CSP builder, JSON-LD, graphics manifest, vaul style hash |
| `test:integration`                             | Empty, passes with no tests. Needs the Supabase test schema (Phase 1)                                                          |
| `test:socket`                                  | Empty, same                                                                                                                    |
| `test:browser`, `test:a11y`, `test:responsive` | Placeholders that print a note. Playwright arrives in Phase 1                                                                  |

## Rules

- Tests live in `tests/`. Shared helpers go in `tests/helpers`.
- Test data uses the `e2e_` or `test_` prefix, cleans up after itself and only touches the `gistroom_test` schema.
- Emoji in tests are written as escapes, for example `"\u{1F600}"`.
- Strings that the copy checker forbids are built from fragments in tests, so the test files stay clean.
- UI checks that need a real browser are done with Playwright, not by reading markup.

## Targeted runs

`npm run verify:changed` compares your work with `origin/main` (or `--base <ref>`) and runs only the matching checks: copy and UI rules, ESLint and Prettier on the changed files, typecheck when TypeScript changed, Vitest with `--changed` for unit, integration and socket tests, and the Playwright specs that map to the changed areas (the map lives in `scripts/verify-changed.mjs`). Add `--no-browser` to skip Playwright. The full `npm run verify` still runs in CI and before a release, and CI is the final word.
