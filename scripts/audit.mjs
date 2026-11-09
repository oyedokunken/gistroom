// Fails on high or critical npm advisories unless they are on the reviewed allow list below.
// Each entry needs a reason and an expiry, so an old exception turns the build red again.
import { spawnSync } from "node:child_process";

const ALLOW = [
  {
    id: "GHSA-3f6p-5ww8-9rcr",
    reason: "mysql2 comes from the Prisma CLI. Gistroom uses Postgres only and never loads it.",
    expires: "2027-01-10",
  },
  {
    id: "GHSA-rgwj-5xj2-c3m3",
    reason: "mysql2 comes from the Prisma CLI. Gistroom uses Postgres only and never loads it.",
    expires: "2027-01-10",
  },
  {
    id: "GHSA-ggr8-5vv4-36mx",
    reason:
      "deepmerge-ts is used by the Prisma CLI to merge our own non recursive config at build time.",
    expires: "2027-01-10",
  },
];

const result = spawnSync("npm audit --omit=dev --json", {
  encoding: "utf8",
  shell: true,
  maxBuffer: 32 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error("audit: could not read npm audit output.");
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

const now = new Date();
const allowed = new Map(ALLOW.filter((a) => new Date(a.expires) > now).map((a) => [a.id, a]));
for (const a of ALLOW) {
  if (new Date(a.expires) <= now)
    console.error(`audit: allow list entry ${a.id} has expired, review it.`);
}

const blocking = [];
for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of v.via ?? []) {
    if (typeof via === "string") continue;
    if (via.severity !== "high" && via.severity !== "critical") continue;
    const id =
      String(via.url ?? "")
        .split("/")
        .pop() ?? "";
    if (!allowed.has(id)) blocking.push(`${name}: ${via.title} (${via.url})`);
  }
}

if (blocking.length > 0) {
  console.error("audit failed, unreviewed high severity advisories:");
  for (const b of blocking) console.error(`  ${b}`);
  process.exit(1);
}
const skipped = [...allowed.keys()].length;
console.log(`audit ok (${skipped} reviewed exceptions, see scripts/audit.mjs)`);
