/**
 * A small PDF writer for the data report. It draws text in the two standard Helvetica fonts, filled shapes and JPEG
 * pictures, which is everything the report needs, so there is no dependency (R24). JPEG data goes in as it is, so no
 * image decoder is needed. Text that Helvetica cannot draw is simplified first, so a name with Yoruba marks still
 * reads, and the Naira sign becomes NGN.
 */

export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;

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

/** A hex colour from the tokens to the three 0 to 1 numbers a PDF fill colour uses. */
function rgb(hex: string): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const part = (shift: number) => (((n >> shift) & 255) / 255).toFixed(3);
  return `${part(16)} ${part(8)} ${part(0)}`;
}

/** Helvetica averages a little over half an em per character. A shade over keeps wrapped lines inside the page. */
const EM_WIDTH = 0.53;
const BOLD_EM_WIDTH = 0.57;

export function textWidth(text: string, size: number, bold = false): number {
  return text.length * size * (bold ? BOLD_EM_WIDTH : EM_WIDTH);
}

/** Splits text into lines that fit a width. A word longer than the line is broken. */
export function wrapText(text: string, size: number, width: number, bold = false): string[] {
  const max = Math.max(8, Math.floor(width / (size * (bold ? BOLD_EM_WIDTH : EM_WIDTH))));
  const out: string[] = [];
  for (const paragraph of pdfSafe(text).split("\n")) {
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

interface JpegImage {
  data: Buffer;
  width: number;
  height: number;
  components: number;
}

/** Reads the size and colour layout of a baseline or progressive JPEG, or null if it is not one. */
export function readJpeg(data: Buffer): JpegImage | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < data.length) {
    if (data[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = data[i + 1] ?? 0;
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    const length = data.readUInt16BE(i + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return {
        data,
        height: data.readUInt16BE(i + 5),
        width: data.readUInt16BE(i + 7),
        components: data[i + 9] ?? 3,
      };
    }
    i += 2 + length;
  }
  return null;
}

interface Op {
  ops: string[];
}

export interface TextStyle {
  size?: number;
  bold?: boolean;
  color: string;
}

/**
 * One document. Coordinates start at the top left corner of the page and grow downwards, in points, which is how a
 * layout is easier to think about than the PDF default of the bottom left.
 */
export class PdfDoc {
  private pages: Op[] = [];
  private images: JpegImage[] = [];

  constructor(private readonly title: string) {
    this.addPage();
  }

  addPage(): void {
    this.pages.push({ ops: [] });
    this.current = this.pages.length - 1;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  /** Picks the page later drawing goes to, so a footer can be added to every page at the end. */
  private current = 0;
  goToPage(index: number): void {
    this.current = Math.max(0, Math.min(index, this.pages.length - 1));
  }
  endPage(): void {
    this.current = this.pages.length - 1;
  }

  private push(op: string): void {
    this.pages[this.current]?.ops.push(op);
  }

  addImage(data: Buffer): number | null {
    const image = readJpeg(data);
    if (!image) return null;
    this.images.push(image);
    return this.images.length - 1;
  }

  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { fill?: string; stroke?: string; radius?: number; lineWidth?: number },
  ): void {
    const top = PAGE_HEIGHT - y - h;
    const r = Math.min(opts.radius ?? 0, w / 2, h / 2);
    const parts: string[] = ["q"];
    if (opts.fill) parts.push(`${rgb(opts.fill)} rg`);
    if (opts.stroke) parts.push(`${rgb(opts.stroke)} RG ${opts.lineWidth ?? 0.75} w`);
    if (r > 0) {
      const k = r * 0.5523;
      const right = x + w;
      const topEdge = top + h;
      parts.push(
        `${x + r} ${top} m`,
        `${right - r} ${top} l`,
        `${right - r + k} ${top} ${right} ${top + r - k} ${right} ${top + r} c`,
        `${right} ${topEdge - r} l`,
        `${right} ${topEdge - r + k} ${right - r + k} ${topEdge} ${right - r} ${topEdge} c`,
        `${x + r} ${topEdge} l`,
        `${x + r - k} ${topEdge} ${x} ${topEdge - r + k} ${x} ${topEdge - r} c`,
        `${x} ${top + r} l`,
        `${x} ${top + r - k} ${x + r - k} ${top} ${x + r} ${top} c`,
        "h",
      );
    } else {
      parts.push(`${x} ${top} ${w} ${h} re`);
    }
    parts.push(opts.fill && opts.stroke ? "B" : opts.fill ? "f" : "S", "Q");
    this.push(parts.join(" "));
  }

  circle(cx: number, cy: number, radius: number, opts: { fill?: string; stroke?: string }): void {
    this.rect(cx - radius, cy - radius, radius * 2, radius * 2, { ...opts, radius });
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, width = 0.75): void {
    this.push(
      `q ${rgb(color)} RG ${width} w ${x1} ${PAGE_HEIGHT - y1} m ${x2} ${PAGE_HEIGHT - y2} l S Q`,
    );
  }

  /** One line of text with its baseline at y. Long text is the caller's job to wrap. */
  text(x: number, y: number, text: string, style: TextStyle): void {
    const size = style.size ?? 10;
    const font = style.bold ? "F2" : "F1";
    const safe = pdfSafe(text).replace(/\n/g, " ");
    if (!safe) return;
    this.push(
      `BT /${font} ${size} Tf ${rgb(style.color)} rg ${x.toFixed(1)} ${(PAGE_HEIGHT - y).toFixed(1)} Td (${escapeText(safe)}) Tj ET`,
    );
  }

  /** Draws a picture into a box. With `round` it is cropped to a circle, like an avatar. */
  image(id: number, x: number, y: number, w: number, h: number, round = false): void {
    const top = PAGE_HEIGHT - y - h;
    const parts = ["q"];
    if (round) {
      const r = w / 2;
      const k = r * 0.5523;
      const cx = x + r;
      const cy = top + r;
      parts.push(
        `${cx + r} ${cy} m`,
        `${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c`,
        `${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c`,
        `${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c`,
        `${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c`,
        "h W n",
      );
    }
    parts.push(`${w} 0 0 ${h} ${x} ${top} cm /Im${id} Do Q`);
    this.push(parts.join(" "));
  }

  toBuffer(): Buffer {
    // Objects: 1 catalog, 2 page tree, 3 and 4 fonts, 5 info, then the pictures, then a content and a page per page.
    const objects: (string | Buffer)[] = [];
    const add = (body: string | Buffer) => objects.push(body);
    add("<< /Type /Catalog /Pages 2 0 R >>");
    const imageFirst = 6;
    const pageFirst = imageFirst + this.images.length;
    const kids = this.pages.map((_, i) => `${pageFirst + i * 2 + 1} 0 R`).join(" ");
    add(`<< /Type /Pages /Kids [${kids}] /Count ${this.pages.length} >>`);
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    add(`<< /Title (${escapeText(pdfSafe(this.title))}) /Producer (Gistroom) >>`);
    for (const img of this.images) {
      const space =
        img.components === 1 ? "/DeviceGray" : img.components === 4 ? "/DeviceCMYK" : "/DeviceRGB";
      add(
        Buffer.concat([
          Buffer.from(
            `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace ${space} /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\nstream\n`,
            "latin1",
          ),
          img.data,
          Buffer.from("\nendstream", "latin1"),
        ]),
      );
    }
    const xobjects = this.images.map((_, i) => `/Im${i} ${imageFirst + i} 0 R`).join(" ");
    for (const [i, page] of this.pages.entries()) {
      const stream = page.ops.join("\n");
      add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xobjects} >> >> /Contents ${pageFirst + i * 2} 0 R >>`,
      );
    }

    const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
    const offsets: number[] = [];
    let length = chunks[0]?.length ?? 0;
    for (const [i, body] of objects.entries()) {
      offsets.push(length);
      const part = Buffer.concat([
        Buffer.from(`${i + 1} 0 obj\n`, "latin1"),
        typeof body === "string" ? Buffer.from(body, "latin1") : body,
        Buffer.from("\nendobj\n", "latin1"),
      ]);
      chunks.push(part);
      length += part.length;
    }
    let tail = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) tail += `${String(o).padStart(10, "0")} 00000 n \n`;
    tail += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${length}\n%%EOF\n`;
    chunks.push(Buffer.from(tail, "latin1"));
    return Buffer.concat(chunks);
  }
}
