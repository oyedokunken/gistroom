// Makes a seeded test person do something to a real account on a running Gistroom, so you can watch it land.
//   npm run seed:act -- --as adaeze_okonkwo --to felixdrann@gmail.com --do message --text "Oya, you dey come?"
//   npm run seed:act -- --as blessing_etim --to felixdrann@gmail.com --do request
// Needs APP_URL (the site to call) and INTERNAL_SERVICE_TOKEN in the environment or .env.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const envFile = path.join(process.cwd(), ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m?.[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }
}
const args = process.argv.slice(2);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const as = value("as");
const to = value("to") ?? "felixdrann@gmail.com";
const action = value("do") ?? "message";
const site = (process.env.SEED_SITE ?? process.env.APP_URL ?? "").replace(/\/$/, "");
const token = process.env.INTERNAL_SERVICE_TOKEN;
if (!as || !site || !token) {
  process.stderr.write(
    "Usage: seed:act --as <seeded username> --to <email> --do message|request [--text ...]\nNeeds APP_URL (or SEED_SITE) and INTERNAL_SERVICE_TOKEN.\n",
  );
  process.exit(1);
}
const res = await fetch(`${site}/api/internal/seed/act`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ as, to, action, text: value("text") }),
});
process.stdout.write(`${res.status} ${await res.text()}\n`);
