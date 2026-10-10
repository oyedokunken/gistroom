import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, resolveTheme, themeInitScript } from "../../apps/web/src/lib/theme";

describe("theme", () => {
  it("defaults to light even when the device prefers dark", () => {
    expect(DEFAULT_THEME).toBe("light");
    expect(resolveTheme(DEFAULT_THEME, true)).toBe("light");
  });
  it("only follows the device when the preference is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });
  it("ships an init script that falls back to light", () => {
    expect(themeInitScript).toContain('"light"');
    expect(themeInitScript).toContain("gr_theme");
  });
});
