import { z } from "zod";
import { LIMITS } from "./limits";

/**
 * Upload rules shared by the browser (to fail early) and the server (the check that counts).
 * The server never trusts the declared type: it reads the first bytes of the stored file (R15).
 */

export type MediaKind = "IMAGE" | "VIDEO" | "VOICE" | "FILE";
export type UploadPurpose = "chat" | "avatar";

export interface MediaRule {
  kind: MediaKind;
  mime: string;
  exts: readonly string[];
  maxBytes: number;
  /** Container types the first bytes may show for this declared type. */
  detected: readonly string[];
}

const MB = 1024 * 1024;

export const MEDIA_RULES: readonly MediaRule[] = [
  {
    kind: "IMAGE",
    mime: "image/jpeg",
    exts: ["jpg", "jpeg"],
    maxBytes: LIMITS.IMAGE_MAX_RAW_MB * MB,
    detected: ["image/jpeg"],
  },
  {
    kind: "IMAGE",
    mime: "image/png",
    exts: ["png"],
    maxBytes: LIMITS.IMAGE_MAX_RAW_MB * MB,
    detected: ["image/png"],
  },
  {
    kind: "IMAGE",
    mime: "image/webp",
    exts: ["webp"],
    maxBytes: LIMITS.IMAGE_MAX_RAW_MB * MB,
    detected: ["image/webp"],
  },
  {
    kind: "IMAGE",
    mime: "image/gif",
    exts: ["gif"],
    maxBytes: LIMITS.IMAGE_MAX_RAW_MB * MB,
    detected: ["image/gif"],
  },
  {
    kind: "VIDEO",
    mime: "video/mp4",
    exts: ["mp4", "m4v"],
    maxBytes: LIMITS.MAX_VIDEO_UPLOAD_MB * MB,
    detected: ["video/mp4"],
  },
  {
    kind: "VIDEO",
    mime: "video/quicktime",
    exts: ["mov"],
    maxBytes: LIMITS.MAX_VIDEO_UPLOAD_MB * MB,
    detected: ["video/quicktime", "video/mp4"],
  },
  {
    kind: "VIDEO",
    mime: "video/webm",
    exts: ["webm"],
    maxBytes: LIMITS.MAX_VIDEO_UPLOAD_MB * MB,
    detected: ["video/webm"],
  },
  {
    kind: "VOICE",
    mime: "audio/webm",
    exts: ["webm"],
    maxBytes: 10 * MB,
    detected: ["video/webm"],
  },
  {
    kind: "VOICE",
    mime: "audio/mp4",
    exts: ["m4a", "mp4"],
    maxBytes: 10 * MB,
    detected: ["audio/mp4", "video/mp4"],
  },
  {
    kind: "VOICE",
    mime: "audio/ogg",
    exts: ["ogg", "oga"],
    maxBytes: 10 * MB,
    detected: ["audio/ogg"],
  },
  { kind: "VOICE", mime: "audio/mpeg", exts: ["mp3"], maxBytes: 10 * MB, detected: ["audio/mpeg"] },
  {
    kind: "FILE",
    mime: "application/pdf",
    exts: ["pdf"],
    maxBytes: LIMITS.FILE_MAX_MB * MB,
    detected: ["application/pdf"],
  },
  {
    kind: "FILE",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    exts: ["docx"],
    maxBytes: LIMITS.FILE_MAX_MB * MB,
    detected: ["application/zip"],
  },
  {
    kind: "FILE",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    exts: ["xlsx"],
    maxBytes: LIMITS.FILE_MAX_MB * MB,
    detected: ["application/zip"],
  },
  {
    kind: "FILE",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    exts: ["pptx"],
    maxBytes: LIMITS.FILE_MAX_MB * MB,
    detected: ["application/zip"],
  },
  {
    kind: "FILE",
    mime: "text/plain",
    exts: ["txt"],
    maxBytes: LIMITS.FILE_MAX_MB * MB,
    detected: ["text/plain"],
  },
  {
    kind: "FILE",
    mime: "text/csv",
    exts: ["csv"],
    maxBytes: LIMITS.FILE_MAX_MB * MB,
    detected: ["text/plain"],
  },
];

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0) =>
  sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, at: number, len: number) =>
  String.fromCharCode(...Array.from(b.slice(at, at + len)));

/** The container type the first bytes show, or null when they match nothing we accept. */
export function detectMime(head: Uint8Array): string | null {
  if (head.length < 4) return null;
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(head, 0, 4) === "GIF8") return "image/gif";
  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 4) === "WEBP") return "image/webp";
  if (ascii(head, 0, 5) === "%PDF-") return "application/pdf";
  if (ascii(head, 4, 4) === "ftyp") {
    const brand = ascii(head, 8, 4);
    if (brand === "qt  ") return "video/quicktime";
    if (brand === "M4A " || brand === "M4B ") return "audio/mp4";
    return "video/mp4";
  }
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (ascii(head, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(head, 0, 3) === "ID3" || (head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0))
    return "audio/mpeg";
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  if (looksLikeText(head)) return "text/plain";
  return null;
}

/** Plain text has no NUL bytes and almost no characters that fail to decode. */
function looksLikeText(head: Uint8Array): boolean {
  if (head.length === 0 || head.includes(0)) return false;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(head);
  const bad = (text.match(/�/g) ?? []).length;
  return bad / Math.max(1, text.length) < 0.01;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export type UploadVerdict =
  | { ok: true; rule: MediaRule }
  | { ok: false; reason: "TYPE" | "TOO_BIG" | "EMPTY" | "MISMATCH" | "NOT_IMAGE" };

/** Check a declared upload before it starts (no bytes yet), or after it lands (with the head bytes). */
export function checkUpload(input: {
  mime: string;
  name: string;
  size: number;
  purpose: UploadPurpose;
  head?: Uint8Array;
}): UploadVerdict {
  const rule = MEDIA_RULES.find((r) => r.mime === input.mime.toLowerCase());
  if (!rule || (input.purpose === "avatar" && rule.kind !== "IMAGE")) {
    return { ok: false, reason: input.purpose === "avatar" ? "NOT_IMAGE" : "TYPE" };
  }
  if (input.size <= 0) return { ok: false, reason: "EMPTY" };
  const cap = input.purpose === "avatar" ? 5 * MB : rule.maxBytes;
  if (input.size > cap) return { ok: false, reason: "TOO_BIG" };
  const ext = extensionOf(input.name);
  if (input.name && ext && !rule.exts.includes(ext)) return { ok: false, reason: "MISMATCH" };
  if (input.head) {
    const seen = detectMime(input.head);
    if (!seen || !rule.detected.includes(seen)) return { ok: false, reason: "MISMATCH" };
  }
  return { ok: true, rule };
}

/** Which icon family a file card draws. */
export type FileFamily = "pdf" | "word" | "sheet" | "slides" | "text" | "other";

export function fileFamily(mime: string): FileFamily {
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("wordprocessingml")) return "word";
  if (mime.includes("spreadsheetml") || mime === "text/csv") return "sheet";
  if (mime.includes("presentationml")) return "slides";
  if (mime === "text/plain") return "text";
  return "other";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Number of bars stored for a voice note waveform (Section 9.3). */
export const WAVEFORM_BARS = 64;

export const mediaKindOf = (mime: string): MediaKind =>
  MEDIA_RULES.find((r) => r.mime === mime)?.kind ?? "FILE";

/** Message type that a finished upload becomes. */
export const messageTypeFor = (kind: MediaKind): "IMAGE" | "VIDEO" | "VOICE" | "FILE" => kind;

// ---------- Request shapes ----------

const id = z.string().trim().min(1).max(64);

export const signUploadSchema = z.object({
  conversationId: id,
  name: z.string().trim().min(1).max(200),
  mime: z.string().trim().min(3).max(120),
  size: z.number().int().min(1),
  /** The file itself, or a small preview image that goes with it. */
  role: z.enum(["main", "thumb"]).default("main"),
});
export type SignUploadInput = z.infer<typeof signUploadSchema>;

export const finalizeUploadSchema = z.object({
  clientId: z.string().trim().min(8).max(64),
  assetId: id,
  /** Original file name, shown on file cards. */
  fileName: z.string().trim().max(200).nullish(),
  thumbAssetId: id.nullish(),
  caption: z.string().trim().max(LIMITS.MESSAGE_MAX_CHARS).nullish(),
  replyToId: id.nullish(),
  width: z.number().int().min(1).max(20000).nullish(),
  height: z.number().int().min(1).max(20000).nullish(),
  durationMs: z
    .number()
    .int()
    .min(0)
    .max(LIMITS.VOICE_NOTE_MAX_SEC * 1000 * 12)
    .nullish(),
  waveform: z.array(z.number().int().min(0).max(100)).max(WAVEFORM_BARS).nullish(),
});
export type FinalizeUploadInput = z.infer<typeof finalizeUploadSchema>;

export const avatarSignSchema = z.object({
  name: z.string().trim().min(1).max(200),
  mime: z.string().trim().min(3).max(120),
  size: z.number().int().min(1),
});
export const avatarCommitSchema = z.object({ assetId: id });

export interface SignedUpload {
  assetId: string;
  /** PUT the file bytes here with the Content-Type header set to the declared type. */
  uploadUrl: string;
}
