import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { voiceStyle } from "../../apps/web/src/components/chat/voice-styles";

const css = readFileSync(
  path.join(process.cwd(), "apps", "web", "src", "app", "globals.css"),
  "utf8",
);
const hex = (name: string, scope: "light" | "dark"): string => {
  const block =
    scope === "dark"
      ? (css.split(':root[data-theme="dark"]')[1] ?? "")
      : (css.split(":root {")[1] ?? "").split("}")[0]!;
  const own = new RegExp(String.raw`--${name}:\s*(#[0-9a-f]{6})`, "i").exec(block);
  const theme = new RegExp(String.raw`--color-${name}:\s*(#[0-9a-f]{6})`, "i").exec(css);
  const found = own?.[1] ?? theme?.[1];
  if (!found) throw new Error(`token ${name} not found`);
  return found;
};

type Rgb = [number, number, number];
const rgb = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const blend = (fg: Rgb, bg: Rgb, a: number): Rgb =>
  fg.map((c, i) => Math.round(c * a + bg[i]! * (1 - a))) as Rgb;
const lum = ([r, g, b]: Rgb) => {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

const c = (name: string, scope: "light" | "dark" = "light") => rgb(hex(name, scope));
const white: Rgb = [255, 255, 255];

describe("voice note player contrast", () => {
  it("only uses token classes, no raw colors", () => {
    for (const mine of [true, false]) {
      const all = Object.values(voiceStyle(mine)).join(" ");
      expect(all).not.toMatch(/#[0-9a-f]{3,6}|rgb\(/i);
    }
  });

  it("keeps play, hover and focus readable on a green (mine) bubble", () => {
    expect(ratio(c("green-700"), white)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(c("green-700"), c("green-100"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the speed pill readable on a green bubble in every state", () => {
    expect(ratio(white, c("green-700"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(white, c("ink-950"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the time and rest bars readable on the green bubble", () => {
    expect(ratio(white, c("green-600"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(blend(white, c("green-600"), 0.75), c("green-600"))).toBeGreaterThanOrEqual(3);
    expect(ratio(c("yellow-400"), c("green-600"))).toBeGreaterThanOrEqual(3);
  });

  it("keeps their play button and speed pill readable, hover included", () => {
    expect(ratio(white, c("green-600"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(white, c("green-700"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(c("ink-950"), c("green-100"))).toBeGreaterThanOrEqual(4.5);
  });

  for (const scope of ["light", "dark"] as const) {
    it(`keeps their time, speed text and bars readable in the ${scope} theme`, () => {
      const bubble = c("surface-2", scope);
      expect(ratio(c("text-muted", scope), bubble)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c("text", scope), c("surface", scope))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c("text-muted", scope), bubble)).toBeGreaterThanOrEqual(3);
      expect(ratio(c("green-600"), bubble)).toBeGreaterThanOrEqual(3);
    });
  }
});
