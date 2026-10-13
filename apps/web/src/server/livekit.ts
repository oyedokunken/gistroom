import { createHmac } from "node:crypto";
import { errors } from "@gistroom/shared";
import { AppError } from "./http";
import { getEnv } from "./env";

/**
 * LiveKit access tokens, signed here with the API secret. A token is a plain HS256 JWT, so no server SDK is
 * needed just to let someone join. The secret never leaves the server (R20).
 */

const b64 = (value: object | Buffer): string =>
  (Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))).toString("base64url");

export interface TokenInput {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name: string;
  room: string;
  ttlSec: number;
  now?: Date;
  canPublish?: boolean;
  /** Limit what the person may publish, for example camera only after "mute everyone". */
  canPublishSources?: readonly ("microphone" | "camera" | "screen_share")[];
  /** Server to server grant for moderation calls. Never given to a browser. */
  admin?: boolean;
}

export function signLiveKitToken(input: TokenInput): string {
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: input.apiKey,
    sub: input.identity,
    name: input.name,
    nbf: now - 5,
    exp: now + input.ttlSec,
    video: input.admin
      ? { room: input.room, roomAdmin: true }
      : {
          room: input.room,
          roomJoin: true,
          canPublish: input.canPublish ?? input.canPublishSources?.length !== 0,
          canSubscribe: true,
          canPublishData: true,
          ...(input.canPublishSources ? { canPublishSources: [...input.canPublishSources] } : {}),
        },
  };
  const body = `${b64(header)}.${b64(payload)}`;
  const sig = createHmac("sha256", input.apiSecret).update(body).digest();
  return `${body}.${b64(sig)}`;
}

export function livekitConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
}

/** A token for one person to join one room, plus the server URL to connect to. */
export function mintJoin(input: {
  identity: string;
  name: string;
  room: string;
  ttlSec?: number;
  canPublishSources?: readonly ("microphone" | "camera" | "screen_share")[];
}): { token: string; url: string } {
  const env = getEnv();
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw new AppError(503, "SERVER", errors.callsOff);
  }
  return {
    url: env.LIVEKIT_URL,
    token: signLiveKitToken({
      apiKey: env.LIVEKIT_API_KEY,
      apiSecret: env.LIVEKIT_API_SECRET,
      identity: input.identity,
      name: input.name,
      room: input.room,
      ttlSec: input.ttlSec ?? 2 * 3600,
      canPublishSources: input.canPublishSources,
    }),
  };
}

const httpUrl = (url: string) =>
  url.replace(/^wss:/, "https:").replace(/^ws:/, "http:").replace(/\/$/, "");

/**
 * LiveKit room service calls (mute, remove, close). They use a short admin token and never reach the browser.
 * A failure is not fatal: Postgres already holds the decision, and the person is blocked from rejoining.
 */
async function roomService<T>(room: string, method: string, body: object): Promise<T | null> {
  const env = getEnv();
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) return null;
  const token = signLiveKitToken({
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
    identity: "gistroom-server",
    name: "Gistroom",
    room,
    ttlSec: 60,
    admin: true,
  });
  try {
    const res = await fetch(`${httpUrl(env.LIVEKIT_URL)}/twirp/livekit.RoomService/${method}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? ((await res.json().catch(() => ({}))) as T) : null;
  } catch {
    return null;
  }
}

export const removeFromLiveKit = (room: string, identity: string) =>
  roomService(room, "RemoveParticipant", { room, identity });

export const closeLiveKitRoom = (room: string) => roomService(room, "DeleteRoom", { room });

interface Participant {
  identity: string;
  tracks?: { sid: string; type?: string | number; muted?: boolean }[];
}

export type PublishSource = "microphone" | "camera" | "screen_share";

/** What people already inside may publish. Used for "only moderators can unmute" and "cameras off". */
export async function setPublishSources(
  room: string,
  identities: readonly string[],
  sources: readonly PublishSource[],
): Promise<void> {
  for (const identity of identities) {
    await roomService(room, "UpdateParticipant", {
      room,
      identity,
      permission: {
        can_subscribe: true,
        can_publish: sources.length > 0,
        can_publish_data: true,
        can_publish_sources: sources.map((s) => s.toUpperCase()),
      },
    });
  }
}

/** Who LiveKit says is connected right now. Null when LiveKit is not set up or did not answer, so callers never guess. */
export async function listIdentities(room: string): Promise<string[] | null> {
  const list = await roomService<{ participants?: Participant[] }>(room, "ListParticipants", {
    room,
  });
  if (list === null) return null;
  return (list.participants ?? []).map((p) => p.identity);
}

/** Mute one person's microphone or camera, or everyone's microphone except the people listed. */
export async function muteInLiveKit(
  room: string,
  only: string | null,
  except: readonly string[] = [],
  kind: "audio" | "video" = "audio",
): Promise<void> {
  const list = await roomService<{ participants?: Participant[] }>(room, "ListParticipants", {
    room,
  });
  for (const p of list?.participants ?? []) {
    if (only ? p.identity !== only : except.includes(p.identity)) continue;
    for (const t of p.tracks ?? []) {
      const wanted =
        kind === "audio" ? t.type === "AUDIO" || t.type === 0 : t.type === "VIDEO" || t.type === 1;
      if (wanted && !t.muted) {
        await roomService(room, "MutePublishedTrack", {
          room,
          identity: p.identity,
          track_sid: t.sid,
          muted: true,
        });
      }
    }
  }
}
