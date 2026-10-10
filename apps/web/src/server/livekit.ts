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
    video: {
      room: input.room,
      roomJoin: true,
      canPublish: input.canPublish ?? true,
      canSubscribe: true,
      canPublishData: true,
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
    }),
  };
}
