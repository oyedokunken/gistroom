import { describe, expect, it } from "vitest";
import { checkUpload, detectMime, fileFamily, formatBytes } from "../../packages/shared/src";

const bytes = (...v: number[]) => new Uint8Array(v);
const text = (s: string) => new TextEncoder().encode(s);
const pad = (b: Uint8Array, n = 16) => {
  const out = new Uint8Array(Math.max(n, b.length));
  out.set(b);
  return out;
};

describe("detectMime", () => {
  it("reads the common signatures", () => {
    expect(detectMime(pad(bytes(0xff, 0xd8, 0xff, 0xe0)))).toBe("image/jpeg");
    expect(detectMime(pad(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)))).toBe(
      "image/png",
    );
    expect(detectMime(pad(text("GIF89a")))).toBe("image/gif");
    expect(detectMime(pad(text("RIFF\0\0\0\0WEBPVP8 ")))).toBe("image/webp");
    expect(detectMime(pad(text("%PDF-1.7")))).toBe("application/pdf");
    expect(detectMime(pad(bytes(0x50, 0x4b, 0x03, 0x04)))).toBe("application/zip");
    expect(detectMime(pad(bytes(0x1a, 0x45, 0xdf, 0xa3)))).toBe("video/webm");
    expect(detectMime(pad(text("OggS")))).toBe("audio/ogg");
  });
  it("tells mp4, mov and m4a apart by brand", () => {
    expect(detectMime(pad(text("\0\0\0\x18ftypisom")))).toBe("video/mp4");
    expect(detectMime(pad(text("\0\0\0\x14ftypqt  ")))).toBe("video/quicktime");
    expect(detectMime(pad(text("\0\0\0\x18ftypM4A ")))).toBe("audio/mp4");
  });
  it("accepts plain text and rejects binary", () => {
    expect(detectMime(text("name,age\nTunde,30\n"))).toBe("text/plain");
    expect(detectMime(pad(bytes(1, 2, 0, 3, 4, 5, 6, 7)))).toBeNull();
  });
});

describe("checkUpload", () => {
  const jpeg = pad(bytes(0xff, 0xd8, 0xff, 0xe0));
  it("accepts a real image with the right name", () => {
    expect(
      checkUpload({ mime: "image/jpeg", name: "a.jpg", size: 1000, purpose: "chat", head: jpeg })
        .ok,
    ).toBe(true);
  });
  it("refuses an executable renamed to an image", () => {
    const exe = pad(text("MZ\x90\0\x03\0\0\0"));
    expect(
      checkUpload({ mime: "image/jpeg", name: "a.jpg", size: 1000, purpose: "chat", head: exe }),
    ).toEqual({
      ok: false,
      reason: "MISMATCH",
    });
  });
  it("refuses types that are not on the list", () => {
    expect(
      checkUpload({ mime: "application/x-msdownload", name: "a.exe", size: 10, purpose: "chat" })
        .ok,
    ).toBe(false);
    expect(checkUpload({ mime: "image/heic", name: "a.heic", size: 10, purpose: "chat" }).ok).toBe(
      false,
    );
  });
  it("applies size caps and refuses empty files", () => {
    expect(
      checkUpload({
        mime: "application/pdf",
        name: "a.pdf",
        size: 21 * 1024 * 1024,
        purpose: "chat",
      }),
    ).toEqual({
      ok: false,
      reason: "TOO_BIG",
    });
    expect(
      checkUpload({ mime: "application/pdf", name: "a.pdf", size: 0, purpose: "chat" }),
    ).toEqual({
      ok: false,
      reason: "EMPTY",
    });
  });
  it("only allows images for avatars, up to 5 MB", () => {
    expect(
      checkUpload({ mime: "application/pdf", name: "a.pdf", size: 10, purpose: "avatar" }),
    ).toEqual({
      ok: false,
      reason: "NOT_IMAGE",
    });
    expect(
      checkUpload({ mime: "image/png", name: "a.png", size: 6 * 1024 * 1024, purpose: "avatar" }),
    ).toEqual({
      ok: false,
      reason: "TOO_BIG",
    });
  });
  it("checks office files by zip signature and extension", () => {
    const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const zip = pad(bytes(0x50, 0x4b, 0x03, 0x04));
    expect(
      checkUpload({ mime: docx, name: "cv.docx", size: 100, purpose: "chat", head: zip }).ok,
    ).toBe(true);
    expect(
      checkUpload({ mime: docx, name: "cv.exe", size: 100, purpose: "chat", head: zip }),
    ).toEqual({
      ok: false,
      reason: "MISMATCH",
    });
  });
});

describe("helpers", () => {
  it("groups files for icons and formats sizes", () => {
    expect(fileFamily("application/pdf")).toBe("pdf");
    expect(fileFamily("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(
      "sheet",
    );
    expect(fileFamily("text/csv")).toBe("sheet");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
