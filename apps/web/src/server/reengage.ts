import { getDb } from "@gistroom/db";
import {
  LIMITS,
  REENGAGE_MAX_ATTEMPTS,
  decideReengage,
  reengageEmailGate,
  reengageKey,
  windowStartOf,
  type ActivityFacts,
} from "@gistroom/shared";
import { logger } from "./logger";
import { MailBlockedError } from "./mail/transport";
import { sendTemplate } from "./mail/send";
import { loadPrefs, notify } from "./notifications/service";

/**
 * The come back nudge for people who have been away (D105 to D109). Run from the sweep. It looks at a capped number of
 * people, never mails seed, internal, suspended, deleted or unverified accounts, and records one row per person, spell
 * and channel so a retry or an overlapping run cannot send twice. It states no counts and names nobody.
 */

const DAY_MS = 86_400_000;
const PAGE = 100;

export interface ReengageResult {
  examined: number;
  emailed: number;
  inApp: number;
  skipped: number;
  held: number;
  failed: number;
}

export async function sendReengagement(now = new Date()): Promise<ReengageResult> {
  const db = getDb();
  const result: ReengageResult = {
    examined: 0,
    emailed: 0,
    inApp: 0,
    skipped: 0,
    held: 0,
    failed: 0,
  };
  const cutoff = new Date(now.getTime() - LIMITS.REENGAGE_INACTIVE_DAYS * DAY_MS);
  const cooldownStart = new Date(now.getTime() - LIMITS.REENGAGE_COOLDOWN_DAYS * DAY_MS);
  const yearStart = new Date(now.getTime() - 365 * DAY_MS);
  let after: string | undefined;

  while (result.examined < LIMITS.REENGAGE_BATCH) {
    const take = Math.min(PAGE, LIMITS.REENGAGE_BATCH - result.examined);
    const users = await db.user.findMany({
      where: {
        status: "ACTIVE",
        isSeed: false,
        isInternal: false,
        deletedAt: null,
        emailVerifiedAt: { not: null },
        onboardedAt: { not: null },
        createdAt: { lt: cutoff },
        AND: [
          { OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: cutoff } }] },
          { OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }] },
        ],
        sessions: { none: { lastSeenAt: { gte: cutoff } } },
        reengagementNotices: {
          none: {
            channel: "EMAIL",
            status: { in: ["SENT", "SKIPPED", "FAILED"] },
            createdAt: { gt: cooldownStart },
          },
        },
        ...(after ? { id: { gt: after } } : {}),
      },
      orderBy: { id: "asc" },
      take,
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        createdAt: true,
        lastActiveAt: true,
        lastSeenAt: true,
        sessions: { orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
        reengagementNotices: {
          where: { createdAt: { gt: yearStart } },
          select: { windowStart: true, channel: true, status: true, sentAt: true, createdAt: true },
        },
      },
    });
    if (users.length === 0) break;
    after = users[users.length - 1]?.id;
    for (const u of users) {
      result.examined += 1;
      try {
        const sessionAt = u.sessions[0]?.lastSeenAt ?? null;
        const latest =
          [sessionAt, u.lastSeenAt]
            .filter((d): d is Date => d !== null)
            .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
        const facts: ActivityFacts = {
          lastActiveAt: u.lastActiveAt,
          lastSessionAt: latest,
          createdAt: u.createdAt,
        };
        const windowStart = windowStartOf(facts);
        const here = windowStart.getTime();
        // One sent date per earlier spell, so the in app and the email of one spell count once.
        const sentBySpell = new Map<number, Date>();
        for (const r of u.reengagementNotices) {
          const key = r.windowStart.getTime();
          if (r.status !== "SENT" || key === here) continue;
          const at = r.sentAt ?? r.createdAt;
          const prev = sentBySpell.get(key);
          if (!prev || at > prev) sentBySpell.set(key, at);
        }
        const decision = decideReengage(
          facts,
          { sentAt: [...sentBySpell.values()], windows: [] },
          now,
        );
        if (!decision.send) {
          if (decision.reason !== "ACTIVE") {
            await record(u.id, windowStart, "EMAIL", "SKIPPED", decision.reason);
            result.skipped += 1;
          }
          continue;
        }
        const prefs = await loadPrefs(u.id);
        const done = (channel: string) =>
          u.reengagementNotices.find(
            (r) =>
              r.windowStart.getTime() === here && r.channel === channel && r.status !== "PENDING",
          );

        // In the app first: repeating it is harmless because of the dedupe key.
        if (!done("IN_APP")) {
          const row = await notify({
            userId: u.id,
            type: "REENGAGE",
            payload: {},
            dedupeKey: reengageKey(u.id, windowStart),
          });
          await record(
            u.id,
            windowStart,
            "IN_APP",
            row ? "SENT" : "SKIPPED",
            row ? null : "off-or-repeat",
          );
          if (row) result.inApp += 1;
        }

        if (done("EMAIL")) continue;
        const gate = reengageEmailGate({ prefs, timeZone: u.timezone, now });
        if (gate === "QUIET") {
          result.held += 1;
          continue;
        }
        if (gate === "OFF") {
          await record(u.id, windowStart, "EMAIL", "SKIPPED", "switched-off");
          result.skipped += 1;
          continue;
        }
        const sent = await sendEmail(u.id, windowStart, u.email, u.name);
        if (sent === "SENT") result.emailed += 1;
        else if (sent === "FAILED") result.failed += 1;
      } catch (error) {
        result.failed += 1;
        logger.warn(
          { userId: u.id, err: error instanceof Error ? error.message : String(error) },
          "reengagement failed",
        );
      }
    }
    if (users.length < take) break;
  }
  return result;
}

async function record(
  userId: string,
  windowStart: Date,
  channel: "EMAIL" | "IN_APP",
  status: "SENT" | "SKIPPED" | "FAILED",
  reason: string | null,
): Promise<void> {
  const sentAt = status === "SENT" ? new Date() : null;
  await getDb().reengagementNotice.upsert({
    where: { userId_windowStart_channel: { userId, windowStart, channel } },
    create: { userId, windowStart, channel, status, reason, sentAt },
    update: { status, reason, sentAt },
  });
}

/** Claims the spell, sends once and records the outcome. A crash after the send and before the record may send once more. */
async function sendEmail(
  userId: string,
  windowStart: Date,
  email: string,
  name: string,
): Promise<"SENT" | "FAILED" | "SKIPPED" | "BUSY"> {
  const db = getDb();
  await db.reengagementNotice.createMany({
    data: [{ userId, windowStart, channel: "EMAIL", status: "PENDING", attempts: 0 }],
    skipDuplicates: true,
  });
  const row = await db.reengagementNotice.findUnique({
    where: { userId_windowStart_channel: { userId, windowStart, channel: "EMAIL" } },
  });
  if (!row || row.status !== "PENDING") return "BUSY";
  const claim = await db.reengagementNotice.updateMany({
    where: { id: row.id, status: "PENDING", attempts: row.attempts },
    data: { attempts: row.attempts + 1 },
  });
  if (claim.count !== 1) return "BUSY";
  try {
    await sendTemplate("come-back", email, { to: name, path: "/app/discover" });
    await record(userId, windowStart, "EMAIL", "SENT", null);
    return "SENT";
  } catch (error) {
    if (error instanceof MailBlockedError) {
      await record(userId, windowStart, "EMAIL", "SKIPPED", "recipient-not-allowed");
      return "SKIPPED";
    }
    if (row.attempts + 1 >= REENGAGE_MAX_ATTEMPTS) {
      await record(userId, windowStart, "EMAIL", "FAILED", "send-failed");
    }
    return "FAILED";
  }
}
