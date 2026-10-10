import { describe, expect, it } from "vitest";
// @ts-expect-error plain mjs module without types
import { checkText, stripCoAuthor } from "../../scripts/lib/copy-rules.mjs";

const cp = (n: number) => String.fromCodePoint(n);

describe("copy checker", () => {
  it("passes clean copy", () => {
    expect(checkText("No gist yet. Pick a friend and start talking.")).toEqual([]);
  });
  it.each([0x2012, 0x2013, 0x2014, 0x2015])("flags dash U+%s", (n) => {
    const found = checkText(`a${cp(n)}b`);
    expect(found).toHaveLength(1);
    expect(found[0].column).toBe(2);
  });
  it("flags emoji, joiners, keycaps and flags", () => {
    expect(checkText(`hi ${cp(0x1f600)}`)).toHaveLength(1);
    expect(checkText(`x${cp(0x200d)}`)).toHaveLength(1);
    expect(checkText(`1${cp(0xfe0f)}${cp(0x20e3)}`)).toHaveLength(2);
    expect(checkText(`${cp(0x1f1f3)}${cp(0x1f1ec)}`).length).toBeGreaterThan(0);
  });
  it("allows legal marks", () => {
    expect(checkText(`${cp(0xa9)} 2026`)).toEqual([]);
  });
  it("flags banned phrases case insensitively but not inside other words", () => {
    expect(checkText(`A ${"Seam"}less experience`)).toHaveLength(1);
    expect(checkText(`${"Lever"}age this`)).toHaveLength(1);
    expect(checkText("The delved cave")).toEqual([]);
  });
  it("strips co-author trailers", () => {
    expect(stripCoAuthor("Add thing\n\nCo-Authored-By: Someone <a@b.c>")).toBe("Add thing\n");
  });
});
