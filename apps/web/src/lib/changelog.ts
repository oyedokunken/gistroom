import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface ChangelogEntry {
  version: string;
  groups: { label: string; items: string[] }[];
}

/** Reads the Keep a Changelog file. Plain parsing: ## version, ### group, - item. */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let entry: ChangelogEntry | null = null;
  let group: { label: string; items: string[] } | null = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      entry = { version: line.slice(3).replace(/[[\]]/g, "").trim(), groups: [] };
      entries.push(entry);
      group = null;
    } else if (line.startsWith("### ") && entry) {
      group = { label: line.slice(4).trim(), items: [] };
      entry.groups.push(group);
    } else if (line.startsWith("- ") && group) {
      group.items.push(line.slice(2).trim().replace(/`/g, ""));
    } else if (/^\s+\S/.test(line) && group && group.items.length > 0) {
      // A wrapped bullet continues the previous item.
      group.items[group.items.length - 1] += ` ${line.trim()}`;
    }
  }
  return entries.filter((e) => e.groups.some((g) => g.items.length > 0));
}

export function loadChangelog(): ChangelogEntry[] {
  const candidates = [
    path.join(process.cwd(), "CHANGELOG.md"),
    path.join(process.cwd(), "..", "..", "CHANGELOG.md"),
  ];
  const file = candidates.find((p) => existsSync(p));
  if (!file) return [];
  return parseChangelog(readFileSync(file, "utf8"));
}
