import { describe, expect, it } from "vitest";
// @ts-expect-error plain mjs module without types
import { checkSource } from "../../scripts/lib/ui-rules.mjs";

const rules = (file: string, src: string): string[] =>
  checkSource(file, src).map((p: { rule: string }) => p.rule);

describe("ui rules checker", () => {
  it("flags native select", () => {
    expect(rules("a.tsx", "<select><option/></select>")).toContain("R6");
  });
  it("flags validation attributes and missing noValidate", () => {
    expect(rules("a.tsx", "<input required />")).toContain("R5");
    expect(rules("a.tsx", "<input maxLength={4} />")).toContain("R5");
    expect(rules("a.tsx", "<form onSubmit={x}>")).toContain("R5");
    expect(rules("a.tsx", "<form noValidate onSubmit={x}>")).toEqual([]);
  });
  it("flags toast imports and alert", () => {
    expect(rules("a.ts", 'import { toast } from "sonner";')).toContain("R4");
    expect(rules("a.ts", "alert('x')")).toContain("R4");
  });
  it("flags raw hex outside tokens", () => {
    expect(rules("a.tsx", 'const c = "#0E7A43";')).toContain("R11");
    expect(rules("lib/tokens.ts", 'const c = "#0E7A43";')).toEqual([]);
  });
  it("flags images without alt", () => {
    expect(rules("a.tsx", "<img src='x' />")).toContain("R13");
    expect(rules("a.tsx", "<img src='x' alt='' />")).toEqual([]);
  });
  it("flags tokens in localStorage", () => {
    expect(rules("a.ts", "localStorage.setItem('session_token', v)")).toContain("R20");
  });
});
