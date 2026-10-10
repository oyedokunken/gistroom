import { describe, expect, it } from "vitest";
import { parseChangelog } from "../../apps/web/src/lib/changelog";

describe("parseChangelog", () => {
  const md = [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    "### Added",
    "- First thing with `code`.",
    "  continued on the next line.",
    "- Second thing.",
    "",
    "### Changed",
    "- Third thing.",
    "",
    "## [0.1.0]",
    "### Added",
    "- Old thing.",
  ].join("\n");
  it("groups items under versions and joins wrapped bullets", () => {
    const entries = parseChangelog(md);
    expect(entries.map((e) => e.version)).toEqual(["Unreleased", "0.1.0"]);
    expect(entries[0]?.groups.map((g) => g.label)).toEqual(["Added", "Changed"]);
    expect(entries[0]?.groups[0]?.items[0]).toBe(
      "First thing with code. continued on the next line.",
    );
  });
  it("skips versions with nothing in them", () => {
    expect(parseChangelog("## [1.0.0]\n\n## [0.9.0]\n### Added\n- A.")).toHaveLength(1);
  });
});
