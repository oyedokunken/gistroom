import { describe, expect, it } from "vitest";
import { PdfDoc, pdfSafe, readJpeg, wrapText } from "../../apps/web/src/server/account/pdf";
import { LOGO_JPEG } from "../../apps/web/src/server/account/pdf-assets";
import { buildReportPdf, reportTime } from "../../apps/web/src/server/account/report";

const logo = () => Buffer.from(LOGO_JPEG.base64, "base64");

function sampleData(extra: { friends?: number; messages?: number } = {}) {
  const friends = Array.from({ length: extra.friends ?? 2 }, (_, i) => ({
    name: `Friend ${i}`,
    username: `friend_${i}`,
    since: "2026-10-01T10:00:00.000Z",
  }));
  const messages = Array.from({ length: extra.messages ?? 3 }, (_, i) => ({
    conversationId: "c1",
    type: "TEXT" as const,
    body: `Message number ${i} with some words (and brackets)`,
    sentAt: "2026-10-12T18:26:00.000Z",
    editedAt: null,
  }));
  return {
    exportedAt: "2026-10-12T18:26:00.000Z",
    note: "x",
    profile: {
      name: "Ọláwálé Ẹ̀bùn",
      username: "olawale",
      email: "olawale@gmail.com",
      bio: "I talk about football.",
      avatar: null,
      timezone: "Africa/Lagos",
      createdAt: "2026-09-01T09:00:00.000Z",
      privacy: {
        discoverable: true,
        showPresence: true,
        sendReadReceipts: true,
        roomInvitesFrom: "FRIENDS",
        dataSaver: false,
      },
    },
    interests: ["football", "comedy"],
    friends,
    blocked: [],
    messagesYouSent: messages,
    notes: [],
    calls: [
      {
        kind: "DIRECT",
        direction: "OUTGOING",
        outcome: "ANSWERED",
        mediaType: "AUDIO",
        titleSnapshot: "Friend 0",
        startedAt: "2026-10-11T12:00:00.000Z",
        durationSec: 125,
      },
    ],
    roomsYouHosted: [],
    roomsYouAttended: [],
    devices: [],
    notificationPreferences: null,
  } as unknown as Parameters<typeof buildReportPdf>[0];
}

describe("data report pdf", () => {
  it("writes a valid file with a header, a table of offsets and an end marker", () => {
    const doc = new PdfDoc("Report");
    doc.text(40, 60, "A line with (brackets) and a back\\slash", { size: 10, color: "#0B0B0C" });
    const text = doc.toBuffer().toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain(String.raw`\(brackets\)`);
    expect(text).toContain(String.raw`back\\slash`);
    const start = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(start, start + 4)).toBe("xref");
  });

  it("points every table entry at its object, pictures included", () => {
    const doc = new PdfDoc("Report");
    const id = doc.addImage(logo());
    expect(id).toBe(0);
    doc.image(0, 40, 40, 100, 24);
    const bytes = doc.toBuffer();
    const text = bytes.toString("latin1");
    const entries = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries.length).toBeGreaterThan(5);
    entries.forEach((offset, i) => {
      expect(text.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true);
    });
    expect(text).toContain("/DCTDecode");
  });

  it("reads the size of a jpeg and refuses other files", () => {
    const jpeg = readJpeg(logo());
    expect(jpeg).toMatchObject({ width: LOGO_JPEG.width, height: LOGO_JPEG.height, components: 3 });
    expect(readJpeg(Buffer.from("not an image"))).toBeNull();
    expect(new PdfDoc("x").addImage(Buffer.from("nope"))).toBeNull();
  });

  it("wraps a very long word instead of running off the page", () => {
    const lines = wrapText("a".repeat(400), 10, 300);
    expect(lines.length).toBeGreaterThan(1);
    expect(wrapText("one two three", 10, 400)).toEqual(["one two three"]);
  });

  it("simplifies what Helvetica cannot draw so names stay readable", () => {
    expect(pdfSafe("Ọláwálé Ẹ̀bùn")).toBe("Olawale Ebun");
    expect(pdfSafe("Paid ₦5,000")).toBe("Paid NGN 5,000");
    expect(pdfSafe("It’s “fine”")).toBe('It\'s "fine"');
    expect(pdfSafe("hi \u{1F600}")).toBe("hi ?");
  });

  it("shows times on a 12 hour clock in the person's zone", () => {
    expect(reportTime("2026-10-12T18:26:00.000Z", "Africa/Lagos")).toMatch(/7:26 PM$/);
    expect(reportTime("2026-10-12T08:05:00.000Z", "Africa/Lagos")).toMatch(/9:05 AM$/);
    expect(reportTime(null, "Africa/Lagos")).toBe("never");
  });

  it("builds a branded report with the logo, the person and a footer on each page", () => {
    const text = buildReportPdf(sampleData(), "Africa/Lagos").toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("Your Gistroom data report");
    expect(text).toContain("Olawale Ebun");
    expect(text).toContain("/DCTDecode");
    expect(text).toMatch(/Page 1 of \d+/);
    expect(text).toContain("7:26 PM");
  });

  it("runs onto more pages when there is a lot to say", () => {
    const text = buildReportPdf(
      sampleData({ friends: 60, messages: 120 }),
      "Africa/Lagos",
    ).toString("latin1");
    const pages = Number(/\/Count (\d+)/.exec(text)?.[1]);
    expect(pages).toBeGreaterThan(2);
    expect(text).toContain(`Page ${pages} of ${pages}`);
  });
});
