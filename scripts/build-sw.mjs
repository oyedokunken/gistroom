// Bundles the service worker with esbuild and injects the precache list. Run before next build and next dev.
// Next 16 builds with Turbopack and @serwist/next needs webpack, so this uses the serwist core directly (Decisions D31).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const web = existsSync(path.join(root, "apps", "web")) ? path.join(root, "apps", "web") : root;
const pub = path.join(web, "public");

const precache = [
  "/brand/icon-192.png",
  "/brand/icon-512.png",
  "/brand/badge-96.png",
  "/brand/logo-mark.png",
  "/fonts/noto-sans/noto-sans-latin-400-normal.woff2",
].filter((p) => existsSync(path.join(pub, p)));

const revision = (file) =>
  createHash("sha1")
    .update(readFileSync(path.join(pub, file)))
    .digest("hex")
    .slice(0, 12);
const entries = precache.map((url) => ({ url, revision: revision(url) }));
// The offline page is a route, so it is cached by build id rather than by file.
entries.push({ url: "/offline", revision: process.env.BUILD_ID ?? String(Date.now()) });

await build({
  entryPoints: [path.join(web, "sw", "sw.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: path.join(pub, "sw.js"),
  define: { "self.__SW_MANIFEST": JSON.stringify(entries) },
  logLevel: "warning",
});

writeFileSync(
  path.join(pub, "sw.version.json"),
  JSON.stringify({ entries: entries.length, builtAt: new Date().toISOString() }),
);
process.stdout.write(`sw: built public/sw.js with ${entries.length} precache entries\n`);
