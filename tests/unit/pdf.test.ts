import { describe, expect, it } from "vitest";
import { pdfSafe, renderPdf } from "../../apps/web/src/server/account/pdf";

describe("data report pdf", () => {
  it("writes a valid single file with a header, a table of offsets and an end marker", () => {
    const pdf = renderPdf("Report", [
      { text: "Hello", size: 20, bold: true },
      { text: "A line with (brackets) and a back\\slash" },
    ]);
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain(String.raw`\(brackets\)`);
    expect(text).toContain(String.raw`back\\slash`);
    const start = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(start, start + 4)).toBe("xref");
  });

  it("points every table entry at its object", () => {
    const text = renderPdf("Report", [{ text: "x" }]).toString("latin1");
    const entries = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    entries.forEach((offset, i) => {
      expect(text.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true);
    });
  });

  it("starts a new page when the text runs past the bottom", () => {
    const lines = Array.from({ length: 200 }, (_, i) => ({ text: `Line ${i}` }));
    const text = renderPdf("Long", lines).toString("latin1");
    expect(/\/Count (\d+)/.exec(text)?.[1]).not.toBe("1");
  });

  it("wraps a very long word instead of running off the page", () => {
    const text = renderPdf("Wide", [{ text: "a".repeat(400) }]).toString("latin1");
    expect((text.match(/ Tj ET/g) ?? []).length).toBeGreaterThan(1);
  });

  it("simplifies what Helvetica cannot draw so names stay readable", () => {
    expect(pdfSafe("Ọláwálé Ẹ̀bùn")).toBe("Olawale Ebun");
    expect(pdfSafe("Paid \u20A65,000")).toBe("Paid NGN 5,000");
    expect(pdfSafe("It\u2019s \u201Cfine\u201D")).toBe('It\'s "fine"');
    expect(pdfSafe("hi \u{1F600}")).toBe("hi ?");
  });
});
