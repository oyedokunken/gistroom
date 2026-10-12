// Runs only the checks that matter for what changed, so day to day work does not wait for the whole pipeline.
// The full `npm run verify` still runs in CI and before a release. Usage:
//   npm run verify:changed                 compare with origin/main plus uncommitted work
//   npm run verify:changed -- --base HEAD~1
//   npm run verify:changed -- --no-browser skip Playwright
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(label, cmd, cmdArgs) {
  console.log(`\n== ${label}`);
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`\nverify:changed failed at: ${label}`);
    process.exit(r.status ?? 1);
  }
}

function git(gitArgs) {
  const r = spawnSync("git", gitArgs, { encoding: "utf8" });
  return r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : [];
}

const hasOrigin = git(["rev-parse", "--verify", "origin/main"]).length > 0;
const base = value("--base", hasOrigin ? "origin/main" : "HEAD~1");

const changed = [
  ...new Set([
    ...git(["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`]),
    ...git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]),
    ...git(["ls-files", "--others", "--exclude-standard"]),
  ]),
].filter((f) => existsSync(f));

if (changed.length === 0) {
  console.log("Nothing changed against", base);
  process.exit(0);
}
console.log(`Comparing with ${base}: ${changed.length} changed file(s)`);

const code = changed.filter((f) => /\.(ts|tsx|mjs|js)$/.test(f));
const formatted = changed.filter((f) => /\.(ts|tsx|mjs|js|json|md|css)$/.test(f));
const touches = (re) => changed.some((f) => re.test(f.replace(/\\/g, "/")));

// Cheap checks always run: copy and UI rules read the whole tree in a second or two.
run("copy rules", npm, ["run", "lint:copy"]);
run("ui rules", npm, ["run", "lint:ui"]);
if (code.length) run("eslint on changed files", npx, ["eslint", ...code]);
if (formatted.length) run("prettier on changed files", npx, ["prettier", "--check", ...formatted]);
if (touches(/\.(ts|tsx)$/) || touches(/schema\.prisma$/))
  run("typecheck", npm, ["run", "typecheck"]);

// Vitest knows which tests import a changed file. Anything under tests/ that changed runs too.
const vitest = ["vitest", "run", `--changed=${base}`, "--passWithNoTests"];
run("unit tests for changed code", npx, [...vitest, "--project", "unit"]);
if (
  touches(/^(apps\/(web|realtime)\/src\/server|packages)\//) ||
  touches(/^tests\/(integration|socket)\//)
) {
  run("integration tests for changed code", npx, [...vitest, "--project", "integration"]);
  run("socket tests for changed code", npx, [...vitest, "--project", "socket"]);
}

// Browser specs: the ones you changed, plus the areas the changed source belongs to.
const areas = [
  [
    /(components\/room|server\/rooms|lib\/rooms|api\/rooms)/,
    ["rooms.spec.ts", "mobile-and-rooms.spec.ts", "discover.spec.ts"],
  ],
  [
    /(components\/chat|server\/chat|lib\/chat|api\/(messages|conversations))/,
    ["chats-list.spec.ts"],
  ],
  [/(components\/call|server\/calls|lib\/calls)/, ["live.spec.ts"]],
  [
    /(settings|server\/account|server\/auth|server\/push|api\/me|api\/sessions)/,
    ["settings.spec.ts", "sessions.spec.ts"],
  ],
  [/(notifications)/, ["notifications.spec.ts"]],
  [/(discover|components\/search)/, ["discover.spec.ts"]],
  [
    /(components\/landing|components\/public|\(public\))/,
    ["footer.spec.ts", "public-header-auth.spec.ts", "rhythm-and-copy.spec.ts"],
  ],
  [/(components\/app\/(app-shell|avatar-menu))/, ["avatar-menu.spec.ts"]],
];
const specs = new Set(
  changed
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => /^tests\/browser\/.+\.spec\.ts$/.test(f))
    .map((f) => path.basename(f)),
);
for (const f of changed.map((c) => c.replace(/\\/g, "/"))) {
  if (!f.startsWith("apps/web/src/")) continue;
  for (const [re, list] of areas) if (re.test(f)) for (const s of list) specs.add(s);
}
const chosen = [...specs].filter((s) => existsSync(path.join("tests", "browser", s)));
if (chosen.length && !flag("--no-browser")) {
  run("build for browser tests", npm, ["run", "e2e:build"]);
  run(`browser tests: ${chosen.join(", ")}`, npx, [
    "playwright",
    "test",
    "--grep-invert",
    "@a11y|@responsive",
    ...chosen.map((s) => `tests/browser/${s}`),
  ]);
} else if (!chosen.length) {
  console.log("\nNo browser specs map to these changes.");
}

console.log("\nverify:changed passed. Run `npm run verify` before a release.");
