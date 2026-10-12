/**
 * A small text-only PDF writer for the data report. It uses the two standard Helvetica fonts that every PDF reader
 * has, so nothing is embedded and there is no dependency (R24). Text that Helvetica cannot draw is simplified first,
 * so a name with Yoruba marks still reads, and the Naira sign becomes NGN.
 */

export interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
  /** Extra space above the line, in points. */
  gap?: number;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const LEADING = 1.35;
/** Helvetica averages a little under half an em per character. A little over keeps wrapped lines inside the page. */
const EM_WIDTH = 0.53;

/** Plain Latin text that WinAnsi can show. Marks are dropped and anything else becomes a question mark. */
export function pdfSafe(input: string): string {
  return input
    .replace(/₦/g, "NGN ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[\r\t]/g, " ")
    .replace(/\P{Cc}|\p{Cc}/gu, (c) => {
      const n = c.codePointAt(0) ?? 0;
      return n === 10 || (n >= 32 && n <= 126) || (n >= 160 && n <= 255) ? c : "?";
    });
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, size: number): string[] {
  const max = Math.max(10, Math.floor((PAGE_WIDTH - MARGIN * 2) / (size * EM_WIDTH)));
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      let w = word;
      while (w.length > max) {
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(w.slice(0, max));
        w = w.slice(max);
      }
      const next = line ? `${line} ${w}` : w;
      if (next.length > max) {
        out.push(line);
        line = w;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

export function renderPdf(title: string, lines: readonly PdfLine[]): Buffer {
  // Lay lines out onto pages.
  const pages: string[][] = [[]];
  let y = PAGE_HEIGHT - MARGIN;
  for (const l of lines) {
    const size = l.size ?? 10;
    const font = l.bold ? "F2" : "F1";
    y -= l.gap ?? 0;
    for (const part of wrap(pdfSafe(l.text), size)) {
      y -= size * LEADING;
      if (y < MARGIN) {
        pages.push([]);
        y = PAGE_HEIGHT - MARGIN - size * LEADING;
      }
      const page = pages[pages.length - 1];
      if (part) {
        page?.push(
          `BT /${font} ${size} Tf ${MARGIN} ${y.toFixed(1)} Td (${escapeText(part)}) Tj ET`,
        );
      }
    }
  }

  // Objects: 1 catalog, 2 page tree, 3 and 4 fonts, 5 the info, then a content and a page object per page.
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);
  add("<< /Type /Catalog /Pages 2 0 R >>");
  const firstPage = 6;
  const kids = pages.map((_, i) => `${firstPage + i * 2 + 1} 0 R`).join(" ");
  add(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  add(`<< /Title (${escapeText(pdfSafe(title))}) /Producer (Gistroom) >>`);
  for (const [i, ops] of pages.entries()) {
    const stream = ops.join("\n");
    add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${firstPage + i * 2} 0 R >>`,
    );
  }

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [i, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
