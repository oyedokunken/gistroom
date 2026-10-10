// Renders every email template to .mail-preview/ (git-ignored). Run: npm run mail:preview
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { templates } from "../apps/web/src/server/mail/templates";

const dir = path.join(process.cwd(), ".mail-preview");
await mkdir(dir, { recursive: true });
for (const t of Object.values(templates)) {
  const out = t.render(t.sample as never, { appUrl: "http://localhost:3000" });
  await writeFile(path.join(dir, `${t.id}.html`), out.html);
  await writeFile(path.join(dir, `${t.id}.txt`), `${out.subject}\n\n${out.text}\n`);
  process.stdout.write(`mail preview: .mail-preview/${t.id}.html\n`);
}
