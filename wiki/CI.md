# CI

Workflow: [.github/workflows/ci.yml](../.github/workflows/ci.yml). It runs on every push to `main` and every pull request. The jobs run in parallel and together cover everything `npm run verify` covers.

| Job                                         | What it runs                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Lint, types and audit                       | copy, UI and font checks, ESLint and Prettier, typecheck, graphics manifest, `npm run audit`   |
| Unit tests                                  | `npm run test:unit`                                                                            |
| Build                                       | `npm run build`                                                                                |
| Integration and socket tests                | `npm run test:integration`, `npm run test:socket`, against a Postgres service container        |
| Browser, accessibility and responsive tests | one e2e build, then every Playwright spec, against the same kind of Postgres service container |

- The two database jobs start a throwaway `postgres:16` service with throwaway credentials (no repository secret), create the `citext` and `pg_trgm` extensions in `public`, and apply the committed migrations to the `gistroom_test` schema with `npm run db:migrate`.
- `CI=true` makes `tests/helpers/require-test-db.ts` throw when the test database is not configured. Locally the database suites skip when there is none, in CI they can never skip and pass. The empty suite flags (`--passWithNoTests`) are gone for the same reason. One suite stays opt in: `live.spec.ts` needs `E2E_LIVE=1` and a real LiveKit project, so it runs nightly or before a release, not in CI.
- Builds run with `SKIP_ENV_VALIDATION=true` and placeholder database URLs, only so Prisma can generate its client.
- The audit step runs `scripts/audit.mjs`: any unreviewed high or critical advisory fails CI. Reviewed exceptions (Prisma CLI tooling, Decisions D21) carry an expiry date.
- Playwright browsers are cached by Playwright version. Traces from a failed browser run are kept as an artifact for 7 days.
- Dependabot opens weekly update pull requests, grouped for Radix, Prisma and typescript-eslint.

Local hooks (Husky): `pre-commit` runs lint-staged and typecheck, `commit-msg` checks the message with the copy checker and strips co-author trailers, `pre-push` runs `verify:quick`.
