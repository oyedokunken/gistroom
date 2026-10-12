import { dataReport } from "@/content/account-report";
import { colors } from "@/lib/tokens";
import type { buildExport } from "./service";
import { LOGO_JPEG } from "./pdf-assets";
import { PAGE_HEIGHT, PAGE_WIDTH, PdfDoc, pdfSafe, readJpeg, wrapText } from "./pdf";

type ExportData = Awaited<ReturnType<typeof buildExport>>;

/** The longest list of messages the report prints. The rest stay in the account and are counted. */
const MESSAGE_LIMIT = 300;

const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BAND = 150;
const FOOTER_TOP = PAGE_HEIGHT - 44;
const LEADING = 1.4;

/** "12 Oct 2026, 6:26 PM" in the person's own time zone, always on a 12 hour clock. */
export function reportTime(iso: string | null, timeZone: string): string {
  if (!iso) return dataReport.never;
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-NG", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${date}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

function who(p: { name?: string; username?: string } | null): { name: string; handle: string } {
  return p?.name && p.username
    ? { name: p.name, handle: `@${p.username}` }
    : { name: dataReport.deletedUser, handle: "" };
}

function initials(name: string): string {
  const letters = pdfSafe(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  return letters || "G";
}

/**
 * Fetches a picture for the report. A JPEG goes in as it is. Another format is converted with sharp when the server
 * has it. Anything else, or a slow answer, gives null and the report draws the person's initials instead.
 */
export async function loadAvatarJpeg(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (readJpeg(bytes)) return bytes;
    const sharp = (await import("sharp")).default;
    const out = await sharp(bytes)
      .resize(240, 240, { fit: "cover" })
      .flatten({ background: colors.white })
      .jpeg({ quality: 85 })
      .toBuffer();
    return readJpeg(out) ? out : null;
  } catch {
    return null;
  }
}

/** The person's data as a branded PDF: the logo, their picture, tidy lists and a footer with the time. */
export function buildReportPdf(
  data: ExportData,
  timeZone: string,
  avatar: Buffer | null = null,
): Buffer {
  const doc = new PdfDoc(dataReport.title);
  const logo = doc.addImage(Buffer.from(LOGO_JPEG.base64, "base64"));
  const photo = avatar ? doc.addImage(avatar) : null;
  const made = reportTime(data.exportedAt, timeZone);

  // ----- Cover band -----
  doc.rect(0, 0, PAGE_WIDTH, BAND, { fill: colors.green700 });
  doc.rect(0, BAND, PAGE_WIDTH, 6, { fill: colors.yellow400 });
  if (logo !== null) doc.image(logo, MARGIN, 30, 150, (150 * LOGO_JPEG.height) / LOGO_JPEG.width);
  doc.text(MARGIN, 104, dataReport.title, { size: 24, bold: true, color: colors.white });
  doc.text(MARGIN, 128, dataReport.madeOn(made), { size: 11, color: colors.green100 });

  let y = BAND + 30;

  const newPage = () => {
    doc.addPage();
    doc.rect(0, 0, PAGE_WIDTH, 10, { fill: colors.green700 });
    doc.rect(0, 10, PAGE_WIDTH, 3, { fill: colors.yellow400 });
    y = 44;
  };
  const ensure = (height: number) => {
    if (y + height > FOOTER_TOP - 8) newPage();
  };

  // ----- Profile card -----
  const p = data.profile;
  const bio = p.bio ? wrapText(p.bio, 10, CONTENT_WIDTH - 112) : [];
  const cardHeight = Math.max(112, 74 + Math.min(bio.length, 3) * 14 + 22);
  doc.rect(MARGIN, y, CONTENT_WIDTH, cardHeight, {
    fill: colors.white,
    stroke: colors.ink200,
    radius: 14,
    lineWidth: 1,
  });
  const cx = MARGIN + 20 + 36;
  const cy = y + 20 + 36;
  if (photo !== null) {
    doc.image(photo, MARGIN + 20, y + 20, 72, 72, true);
    doc.circle(cx, cy, 36, { stroke: colors.yellow400 });
  } else {
    doc.circle(cx, cy, 36, { fill: colors.green100, stroke: colors.green600 });
    doc.text(cx - 10 * (initials(p.name).length === 1 ? 0.5 : 1), cy + 8, initials(p.name), {
      size: 22,
      bold: true,
      color: colors.green700,
    });
  }
  const tx = MARGIN + 112;
  doc.text(tx, y + 34, p.name, { size: 18, bold: true, color: colors.ink950 });
  doc.text(tx, y + 52, `@${p.username}`, { size: 11, bold: true, color: colors.green700 });
  doc.text(tx, y + 68, p.email, { size: 10, color: colors.ink700 });
  let by = y + 86;
  for (const line of bio.slice(0, 3)) {
    doc.text(tx, by, line, { size: 10, color: colors.ink500 });
    by += 14;
  }
  doc.text(
    tx,
    by + 2,
    `${dataReport.joined} ${reportTime(p.createdAt, timeZone)}  |  ${p.timezone}`,
    { size: 9, color: colors.ink500 },
  );
  y += cardHeight + 18;

  // ----- Numbers at a glance -----
  const tiles = [
    { n: data.friends.length, label: dataReport.tileFriends },
    { n: data.calls.length, label: dataReport.tileCalls },
    { n: data.roomsYouHosted.length, label: dataReport.tileHosted },
    { n: data.roomsYouAttended.length, label: dataReport.tileJoined },
    { n: data.messagesYouSent.length, label: dataReport.tileMessages },
  ];
  const gap = 8;
  const tileWidth = (CONTENT_WIDTH - gap * (tiles.length - 1)) / tiles.length;
  for (const [i, t] of tiles.entries()) {
    const tx0 = MARGIN + i * (tileWidth + gap);
    doc.rect(tx0, y, tileWidth, 58, { fill: colors.green100, radius: 10 });
    doc.text(tx0 + 12, y + 29, String(t.n), { size: 20, bold: true, color: colors.green700 });
    doc.text(tx0 + 12, y + 46, t.label, { size: 8.5, color: colors.ink700 });
  }
  y += 58 + 22;

  // ----- Sections -----
  const heading = (text: string) => {
    ensure(52);
    doc.rect(MARGIN, y, 4, 16, { fill: colors.yellow400, radius: 2 });
    doc.text(MARGIN + 12, y + 13, text, { size: 13, bold: true, color: colors.ink950 });
    y += 28;
  };
  const empty = () => {
    doc.text(MARGIN + 12, y + 10, dataReport.nothing, { size: 10, color: colors.ink500 });
    y += 30;
  };

  type Cell = { x: number; w: number; text: string; bold?: boolean; color?: string };
  let zebra = false;
  const row = (cells: Cell[], opts: { badge?: string } = {}) => {
    const size = 9.5;
    const wrapped = cells.map((c) => wrapText(c.text, size, c.w, c.bold).slice(0, 6));
    const lines = Math.max(1, ...wrapped.map((w) => w.length));
    const height = lines * size * LEADING + 10;
    ensure(height);
    if (zebra) doc.rect(MARGIN, y, CONTENT_WIDTH, height, { fill: colors.ink100, radius: 5 });
    zebra = !zebra;
    if (opts.badge) {
      doc.circle(MARGIN + 18, y + height / 2, 9, { fill: colors.green100 });
      doc.text(MARGIN + 18 - (opts.badge.length > 1 ? 6 : 3), y + height / 2 + 3, opts.badge, {
        size: 8,
        bold: true,
        color: colors.green700,
      });
    }
    for (const [i, c] of cells.entries()) {
      let ly = y + 5 + size;
      for (const part of wrapped[i] ?? []) {
        doc.text(c.x, ly, part, { size, bold: c.bold, color: c.color ?? colors.ink700 });
        ly += size * LEADING;
      }
    }
    y += height;
  };
  const end = () => {
    zebra = false;
    y += 16;
  };

  heading(dataReport.interests);
  if (data.interests.length) {
    const wrapped = wrapText(data.interests.join(", "), 10, CONTENT_WIDTH - 24);
    for (const line of wrapped) {
      ensure(16);
      doc.text(MARGIN + 12, y + 10, line, { size: 10, color: colors.ink700 });
      y += 15;
    }
    y += 10;
  } else empty();

  heading(dataReport.friends(data.friends.length));
  if (!data.friends.length) empty();
  for (const f of data.friends) {
    const w = who(f);
    row(
      [
        { x: MARGIN + 36, w: 190, text: w.name, bold: true, color: colors.ink950 },
        { x: MARGIN + 236, w: 120, text: w.handle, color: colors.green700 },
        { x: MARGIN + 366, w: 140, text: dataReport.since(reportTime(f.since, timeZone)) },
      ],
      { badge: initials(w.name) },
    );
  }
  end();

  heading(dataReport.blocked(data.blocked.length));
  if (!data.blocked.length) empty();
  for (const b of data.blocked) {
    const w = who(b);
    row(
      [
        { x: MARGIN + 36, w: 190, text: w.name, bold: true, color: colors.ink950 },
        { x: MARGIN + 236, w: 120, text: w.handle },
        { x: MARGIN + 366, w: 140, text: dataReport.since(reportTime(b.since, timeZone)) },
      ],
      { badge: initials(w.name) },
    );
  }
  end();

  heading(dataReport.calls(data.calls.length));
  if (!data.calls.length) empty();
  for (const c of data.calls) {
    const mins = Math.floor(c.durationSec / 60);
    const secs = String(c.durationSec % 60).padStart(2, "0");
    row([
      { x: MARGIN + 10, w: 130, text: reportTime(c.startedAt, timeZone) },
      { x: MARGIN + 150, w: 170, text: c.titleSnapshot, bold: true, color: colors.ink950 },
      { x: MARGIN + 330, w: 60, text: dataReport.mediaLabel(c.mediaType) },
      { x: MARGIN + 395, w: 70, text: dataReport.outcomeLabel(c.outcome) },
      { x: MARGIN + 470, w: 40, text: `${mins}:${secs}` },
    ]);
  }
  end();

  heading(dataReport.hosted(data.roomsYouHosted.length));
  if (!data.roomsYouHosted.length) empty();
  for (const r of data.roomsYouHosted) {
    row([
      { x: MARGIN + 10, w: 300, text: r.title, bold: true, color: colors.ink950 },
      { x: MARGIN + 320, w: 90, text: dataReport.statusLabel(r.status) },
      { x: MARGIN + 420, w: 90, text: dataReport.visibilityLabel(r.visibility) },
    ]);
  }
  end();

  heading(dataReport.attended(data.roomsYouAttended.length));
  if (!data.roomsYouAttended.length) empty();
  for (const r of data.roomsYouAttended) {
    row([
      { x: MARGIN + 10, w: 250, text: r.title, bold: true, color: colors.ink950 },
      { x: MARGIN + 270, w: 80, text: dataReport.roleLabel(r.role) },
      { x: MARGIN + 360, w: 150, text: reportTime(r.joinedAt, timeZone) },
    ]);
  }
  end();

  heading(dataReport.notes(data.notes.length));
  if (!data.notes.length) empty();
  for (const n of data.notes) {
    row([
      { x: MARGIN + 10, w: 130, text: reportTime(n.createdAt, timeZone) },
      { x: MARGIN + 150, w: 360, text: n.body },
    ]);
  }
  end();

  heading(dataReport.devices(data.devices.length));
  if (!data.devices.length) empty();
  for (const d of data.devices) {
    row([
      {
        x: MARGIN + 10,
        w: 220,
        text: d.device ?? dataReport.unknownDevice,
        bold: true,
        color: colors.ink950,
      },
      { x: MARGIN + 240, w: 190, text: dataReport.lastSeen(reportTime(d.lastSeenAt, timeZone)) },
      { x: MARGIN + 440, w: 70, text: d.signedOut ? dataReport.signedOut : dataReport.active },
    ]);
  }
  end();

  heading(dataReport.messages(data.messagesYouSent.length));
  if (!data.messagesYouSent.length) empty();
  const shown = data.messagesYouSent.slice(-MESSAGE_LIMIT);
  if (shown.length < data.messagesYouSent.length) {
    doc.text(
      MARGIN + 12,
      y + 8,
      dataReport.messagesCut(shown.length, data.messagesYouSent.length),
      {
        size: 9,
        color: colors.ink500,
      },
    );
    y += 22;
  }
  for (const m of shown) {
    row([
      { x: MARGIN + 10, w: 130, text: reportTime(m.sentAt, timeZone) },
      {
        x: MARGIN + 150,
        w: 360,
        text: m.type === "TEXT" ? (m.body ?? "") : `[${m.type.toLowerCase()}]`,
      },
    ]);
  }

  // ----- Footer on every page -----
  const total = doc.pageCount;
  for (let i = 0; i < total; i += 1) {
    doc.goToPage(i);
    doc.line(MARGIN, FOOTER_TOP, PAGE_WIDTH - MARGIN, FOOTER_TOP, colors.ink200, 0.75);
    doc.text(MARGIN, FOOTER_TOP + 18, dataReport.footerBrand, {
      size: 8.5,
      bold: true,
      color: colors.green700,
    });
    doc.text(MARGIN + 120, FOOTER_TOP + 18, dataReport.footerMade(made), {
      size: 8.5,
      color: colors.ink500,
    });
    doc.text(PAGE_WIDTH - MARGIN - 54, FOOTER_TOP + 18, dataReport.footerPage(i + 1, total), {
      size: 8.5,
      color: colors.ink500,
    });
  }
  doc.endPage();

  return doc.toBuffer();
}
