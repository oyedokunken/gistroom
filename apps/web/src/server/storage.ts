import { AppError } from "./http";
import { getEnv } from "./env";
import { errors } from "@gistroom/shared";

/**
 * Supabase Storage over its REST API with the service role key. The key stays on the server (R20).
 * Chat media lives in a private bucket and is only ever opened through short lived signed links (R15).
 */

interface Config {
  url: string;
  key: string;
  mediaBucket: string;
  publicBucket: string;
}

function config(): Config {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError(503, "SERVER", errors.uploadsOff);
  }
  return {
    url: env.SUPABASE_URL.replace(/\/$/, ""),
    key: env.SUPABASE_SERVICE_ROLE_KEY,
    mediaBucket: env.SUPABASE_MEDIA_BUCKET,
    publicBucket: env.SUPABASE_PUBLIC_BUCKET,
  };
}

export const buckets = {
  media: () => config().mediaBucket,
  avatars: () => config().publicBucket,
};

function headers(c: Config, extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${c.key}`, apikey: c.key, ...extra };
}

async function call(res: Response): Promise<Response> {
  if (!res.ok) throw new AppError(502, "SERVER", errors.server);
  return res;
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/** A one time URL the browser can PUT the file to. */
export async function createSignedUploadUrl(bucket: string, path: string): Promise<string> {
  const c = config();
  const res = await call(
    await fetch(`${c.url}/storage/v1/object/upload/sign/${bucket}/${encodePath(path)}`, {
      method: "POST",
      headers: headers(c, { "Content-Type": "application/json" }),
      body: "{}",
    }),
  );
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new AppError(502, "SERVER", errors.server);
  return `${c.url}/storage/v1${data.url.startsWith("/") ? data.url : `/${data.url}`}`;
}

/** A link that opens the file for a few minutes. */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSec = 300,
): Promise<string> {
  const c = config();
  const res = await call(
    await fetch(`${c.url}/storage/v1/object/sign/${bucket}/${encodePath(path)}`, {
      method: "POST",
      headers: headers(c, { "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: expiresInSec }),
    }),
  );
  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) throw new AppError(502, "SERVER", errors.server);
  const rel = data.signedURL.startsWith("/") ? data.signedURL : `/${data.signedURL}`;
  return `${c.url}/storage/v1${rel}`;
}

/** The first bytes and the real size of a stored file, or null when it is not there. */
export async function readHead(
  bucket: string,
  path: string,
  bytes = 512,
): Promise<{ head: Uint8Array; size: number } | null> {
  const c = config();
  const url = await createSignedUrl(bucket, path, 60);
  const res = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` } });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok && res.status !== 206) throw new AppError(502, "SERVER", errors.server);
  const buf = new Uint8Array(await res.arrayBuffer());
  const range = res.headers.get("content-range");
  const total = range?.split("/")[1];
  const size =
    total && /^\d+$/.test(total)
      ? Number(total)
      : Number(res.headers.get("content-length") ?? buf.length);
  void c;
  return { head: buf.slice(0, bytes), size };
}

export async function removeObjects(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const c = config();
  try {
    await fetch(`${c.url}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: headers(c, { "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: paths }),
    });
  } catch {
    // The daily sweep removes anything left behind.
  }
}
