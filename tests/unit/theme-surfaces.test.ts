import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(process.cwd(), "apps", "web", "src", "components");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/** The surface behind the header logo and the footer wordmark must always be the theme surface (Task 5). */
describe("logo animation surfaces follow the theme", () => {
  for (const file of ["landing/voice-dock.tsx", "landing/footer.tsx"]) {
    it(`${file} never hard codes a black or white surface`, () => {
      const source = read(file);
      expect(source).not.toMatch(/\bbg-(ink-950|white|black)\b/);
    });
  }
  it("the footer wordmark animation does not animate any color", () => {
    const source = read("landing/footer.tsx");
    expect(source).not.toMatch(/backgroundColor|background:|color:\s*\[/);
  });
});
