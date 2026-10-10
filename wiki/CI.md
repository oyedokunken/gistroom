# CI

Workflow: [.github/workflows/ci.yml](../.github/workflows/ci.yml). It runs on every push to `main` and every pull request.

Steps: checkout, Node 20, `npm ci`, `npm run verify`, then the audit script.

- The build runs with `SKIP_ENV_VALIDATION=true` and placeholder database URLs, only so Prisma can generate its client.
- The audit step runs `scripts/audit.mjs`: any unreviewed high or critical advisory fails CI. Reviewed exceptions (Prisma CLI tooling, Decisions D21) carry an expiry date.
- Playwright browsers are installed in CI once the browser suite exists (Phase 1). Until then the browser, a11y and responsive steps of `verify` are placeholders.
- Dependabot opens weekly update pull requests, grouped for Radix, Prisma and typescript-eslint.

Local hooks (Husky): `pre-commit` runs lint-staged and typecheck, `commit-msg` checks the message with the copy checker and strips co-author trailers, `pre-push` runs `verify:quick`.
