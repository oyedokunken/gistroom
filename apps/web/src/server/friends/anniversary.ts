import { getDb, messageInclude } from "@gistroom/db";
import { publish } from "../realtime";
import { dmKeyFor } from "../cursor";

/** Whole years between the day a friendship began and a later day. Leap days count as the 28th. */
export function yearsBetween(since: Date, until: Date): number {
  let years = until.getUTCFullYear() - since.getUTCFullYear();
  const beforeAnniversary =
    until.getUTCMonth() < since.getUTCMonth() ||
    (until.getUTCMonth() === since.getUTCMonth() && until.getUTCDate() < since.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

/** The next anniversary strictly after `after`, in the same month and day as the friendship began. */
export function nextAnniversary(since: Date, after: Date): Date {
  let year = Math.max(after.getUTCFullYear(), since.getUTCFullYear() + 1);
  for (;;) {
    const month = since.getUTCMonth();
    // 29 February falls back to the 28th in years without a leap day.
    const day =
      month === 1 &&
      since.getUTCDate() === 29 &&
      new Date(Date.UTC(year, 1, 29)).getUTCMonth() !== 1
        ? 28
        : since.getUTCDate();
    const candidate = new Date(Date.UTC(year, month, day, 6, 0, 0));
    if (candidate > after && year > since.getUTCFullYear()) return candidate;
    year += 1;
  }
}

/** What a due anniversary should do, as a pure decision so it is easy to test. */
export function anniversaryDecision(input: {
  since: Date;
  nextAt: Date | null;
  celebratedYears: number;
  now: Date;
}): { celebrate: false; nextAt: Date } | { celebrate: true; years: number; nextAt: Date } {
  const nextAt = input.nextAt ?? nextAnniversary(input.since, input.since);
  if (nextAt > input.now) return { celebrate: false, nextAt };
  const years = yearsBetween(input.since, nextAt);
  const following = nextAnniversary(input.since, input.now);
  if (years < 1 || years <= input.celebratedYears) return { celebrate: false, nextAt: following };
  return { celebrate: true, years, nextAt: following };
}

/**
 * Called when a chat is opened. If the friendship has an anniversary due, one SYSTEM message is added to the
 * chat for both people. The client id is built from the friendship and the year, so it can never happen twice.
 */
export async function celebrateIfDue(
  userId: string,
  peerId: string,
  conversationId: string,
  now = new Date(),
): Promise<void> {
  const db = getDb();
  const [low, high] = userId < peerId ? [userId, peerId] : [peerId, userId];
  const friendship = await db.friendship.findUnique({
    where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
  });
  if (!friendship) return;
  const decision = anniversaryDecision({
    since: friendship.createdAt,
    nextAt: friendship.nextAnniversaryAt,
    celebratedYears: friendship.celebratedYears,
    now,
  });
  if (!decision.celebrate) {
    if (!friendship.nextAnniversaryAt || +friendship.nextAnniversaryAt !== +decision.nextAt) {
      await db.friendship.update({
        where: { id: friendship.id },
        data: { nextAnniversaryAt: decision.nextAt },
      });
    }
    return;
  }
  const convo = await db.conversation.findUnique({ where: { dmKey: dmKeyFor(userId, peerId) } });
  if (!convo || convo.id !== conversationId) return;
  const clientId = `anniv:${friendship.id}:${decision.years}`;
  const claimed = await db.friendship.updateMany({
    where: { id: friendship.id, celebratedYears: { lt: decision.years } },
    data: { celebratedYears: decision.years, nextAnniversaryAt: decision.nextAt },
  });
  if (claimed.count === 0) return;
  const row = await db.message.upsert({
    where: { senderId_clientId: { senderId: low, clientId } },
    create: {
      conversationId,
      senderId: low,
      clientId,
      type: "SYSTEM",
      body: null,
      meta: { kind: "FRIENDIVERSARY", years: decision.years },
    },
    update: {},
    include: messageInclude(low),
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: row.createdAt },
  });
  void publish({ type: "message:new", messageId: row.id });
}
