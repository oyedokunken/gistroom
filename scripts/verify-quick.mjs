// The fast checks used by the pre-push hook: copy and UI rules, lint, types and unit tests.
// The stages do not depend on each other once the Prisma client exists, so they run side by side and the run takes
// as long as the slowest one. ESLint, Prettier and TypeScript keep caches, so a second run is faster still.
// Output of each stage is held back and printed in full only when that stage fails.
import { spawn } from "node:child_process";

const STAGES = [
  { name: "lint:copy", command: "npm run lint:copy" },
  { name: "lint:ui", command: "npm run lint:ui" },
  { name: "lint", command: "npm run lint" },
  { name: "typecheck", command: "npm run typecheck:only" },
  { name: "test:unit", command: "npm run test:unit" },
];

function run(command) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, { shell: true, env: process.env });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) =>
      resolve({ code: code ?? 1, output, seconds: (Date.now() - started) / 1000 }),
    );
  });
}

const total = Date.now();
// The generated client is read by both the type check and the unit tests.
const prepared = await run("npm run generate -w @gistroom/db");
if (prepared.code !== 0) {
  process.stderr.write(prepared.output);
  process.exit(1);
}

const results = await Promise.all(
  STAGES.map(async (stage) => ({ ...stage, ...(await run(stage.command)) })),
);
let failed = 0;
for (const r of results) {
  process.stdout.write(
    `${r.code === 0 ? "ok  " : "FAIL"} ${r.name.padEnd(10)} ${r.seconds.toFixed(1)}s\n`,
  );
  if (r.code !== 0) {
    failed += 1;
    process.stdout.write(`\n--- ${r.name} ---\n${r.output}\n`);
  }
}
process.stdout.write(
  `verify:quick ${failed === 0 ? "passed" : "failed"} in ${((Date.now() - total) / 1000).toFixed(1)}s\n`,
);
process.exit(failed === 0 ? 0 : 1);
