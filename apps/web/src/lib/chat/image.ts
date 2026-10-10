import { LIMITS } from "@gistroom/shared";

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  thumb: Blob | null;
}

const MAX_EDGE = 2048;
const THUMB_EDGE = 360;

/** Size after scaling so the longest edge is at most `max`. Never scales up. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function drawn(bitmap: ImageBitmap, edge: number, quality: number) {
  const size = fitWithin(bitmap.width, bitmap.height, edge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // JPEG has no transparency, so fill first.
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await toBlob(canvas, quality);
  return blob ? { blob, ...size } : null;
}

/**
 * Re-encode a photo on the phone: orientation applied, location and camera details dropped, longest edge 2048,
 * aiming for about 1.5 MB (Section 9.3). GIFs go through untouched so they keep moving.
 */
export async function prepareImage(file: File): Promise<PreparedImage | null> {
  if (file.type === "image/gif") return null;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    let quality = 0.85;
    let main = await drawn(bitmap, MAX_EDGE, quality);
    while (main && main.blob.size > LIMITS.IMAGE_TARGET_KB * 1024 && quality > 0.5) {
      quality -= 0.1;
      main = await drawn(bitmap, MAX_EDGE, quality);
    }
    const thumb = await drawn(bitmap, THUMB_EDGE, 0.7);
    bitmap.close();
    if (!main) return null;
    return { blob: main.blob, width: main.width, height: main.height, thumb: thumb?.blob ?? null };
  } catch {
    return null;
  }
}

/** A still from the middle of the first seconds of a video, used as its preview. Null when it cannot be read. */
export async function videoPoster(
  file: File,
): Promise<{ thumb: Blob; width: number; height: number } | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video"));
    });
    video.currentTime = Math.min(1, (video.duration || 1) / 2);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    const size = fitWithin(video.videoWidth, video.videoHeight, THUMB_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, size.width, size.height);
    const blob = await toBlob(canvas, 0.7);
    return blob ? { thumb: blob, width: video.videoWidth, height: video.videoHeight } : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
