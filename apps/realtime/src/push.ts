import { createHash } from "node:crypto";
import webpush from "web-push";
import { PUSH_POLICY, type PushPayload } from "@gistroom/shared";
import type { Logger } from "./sockets";

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushResult {
  ok: boolean;
  statusCode: number | null;
  /** Push is not configured. Not a failure of the subscription. */
  disabled?: boolean;
}

export interface PushSender {
  send(target: PushTarget, payload: PushPayload): Promise<PushResult>;
}

/** Push services cap the Topic header at 32 URL safe characters, so a long tag is hashed. */
export function topicFor(tag: string): string {
  return createHash("sha256").update(tag).digest("base64url").slice(0, 32);
}

export interface VapidConfig {
  publicKey?: string;
  privateKey?: string;
  subject: string;
}

/** Real sender over Web Push with VAPID. Without keys it reports disabled instead of failing subscriptions. */
export function createWebPushSender(vapid: VapidConfig, log: Logger): PushSender {
  const enabled = Boolean(vapid.publicKey && vapid.privateKey);
  if (enabled)
    webpush.setVapidDetails(vapid.subject, vapid.publicKey as string, vapid.privateKey as string);
  else log.warn({}, "VAPID keys are not set, push is switched off");

  return {
    async send(target, payload) {
      if (!enabled) return { ok: false, statusCode: null, disabled: true };
      const policy = PUSH_POLICY[payload.type];
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          JSON.stringify(payload),
          { TTL: policy.ttlSec, urgency: policy.urgency, topic: topicFor(payload.tag) },
        );
        return { ok: true, statusCode: 201 };
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode ?? null;
        return { ok: false, statusCode };
      }
    },
  };
}
