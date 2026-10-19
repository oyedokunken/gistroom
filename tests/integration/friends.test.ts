import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";
import { waitForWindowRoom } from "../helpers/rate-window";

prepareTestEnv();
// Nothing listens here, so LiveKit and realtime calls fail fast and the friend logic is what gets tested.
if (requireTestDb()) {
  process.env.LIVEKIT_URL = "http://nothing-listens.invalid";
  process.env.LIVEKIT_API_KEY = "test_key";
  process.env.LIVEKIT_API_SECRET = "s".repeat(40);
  process.env.REALTIME_URL = "http://nothing-listens.invalid";
}

async function load() {
  const [friends, relations, limiter, shared, db] = await Promise.all([
    import("../../apps/web/src/server/friends/service"),
    import("../../apps/web/src/server/friends/relations"),
    import("../../apps/web/src/server/rate-limit"),
    import("@gistroom/shared"),
    import("@gistroom/db"),
  ]);
  return { ...friends, ...relations, limiter, errors: shared.errors, db: db.getDb() };
}

const DAY = 86_400_000;

describe.skipIf(!requireTestDb())("friends", () => {
  let m: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    m = await load();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await resetTestDb();
  });

  type Person = Awaited<ReturnType<typeof person>>;
  async function person(key: string, over: Record<string, unknown> = {}) {
    return m.db.user.create({
      data: {
        email: `test_fr_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_fr_${key}`,
        onboardedAt: new Date(),
        ...over,
      },
    });
  }
  const unavailable = (e: unknown) => e as { status: number; message: string };
  async function failure(p: Promise<unknown>) {
    return p.then(
      () => {
        throw new Error("expected a failure");
      },
      (e: unknown) => unavailable(e),
    );
  }
  async function becomeFriends(a: Person, b: Person) {
    const sent = await m.sendRequest(a, b.id);
    if (sent.status !== "SENT") throw new Error("expected SENT");
    return m.acceptRequest(b, sent.requestId);
  }
  const notices = (userId: string, type: string) =>
    m.db.notification.findMany({ where: { userId, type: type as never } });

  // ---------- Sending and accepting ----------

  it("sends one request and one notice, and a repeat changes nothing", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    const first = await m.sendRequest(ada, bayo.id);
    expect(first.status).toBe("SENT");
    const again = await m.sendRequest(ada, bayo.id);
    expect(again).toMatchObject({
      status: "ALREADY_SENT",
      requestId: (first as { requestId: string }).requestId,
    });
    expect(await m.db.friendRequest.count({ where: { status: "PENDING" } })).toBe(1);
    expect(await notices(bayo.id, "FRIEND_REQUEST_RECEIVED")).toHaveLength(1);
  });

  it("makes the friendship and the chat on accept, and accepting again returns the same chat", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    const sent = (await m.sendRequest(ada, bayo.id)) as { requestId: string };
    const { conversationId } = await m.acceptRequest(bayo, sent.requestId);

    expect(await m.areFriends(ada.id, bayo.id)).toBe(true);
    const request = await m.db.friendRequest.findUniqueOrThrow({ where: { id: sent.requestId } });
    expect(request.status).toBe("ACCEPTED");
    const members = await m.db.conversationMember.findMany({ where: { conversationId } });
    expect(members.map((x) => x.userId).sort()).toEqual([ada.id, bayo.id].sort());

    // The sender hears about it, and the notice the receiver had is read.
    expect(await notices(ada.id, "FRIEND_REQUEST_ACCEPTED")).toHaveLength(1);
    const original = await notices(bayo.id, "FRIEND_REQUEST_RECEIVED");
    expect(original.every((n) => n.readAt !== null)).toBe(true);

    expect((await m.acceptRequest(bayo, sent.requestId)).conversationId).toBe(conversationId);
    expect(await m.db.friendship.count()).toBe(1);
    expect(await m.db.conversation.count()).toBe(1);
  });

  it("accepts on the spot when both people ask each other", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    await m.sendRequest(ada, bayo.id);
    const back = await m.sendRequest(bayo, ada.id);
    expect(back.status).toBe("ACCEPTED");
    expect(await m.areFriends(ada.id, bayo.id)).toBe(true);
    expect(await m.db.friendRequest.count({ where: { status: "PENDING" } })).toBe(0);
    expect(await m.db.friendRequest.count({ where: { status: "ACCEPTED" } })).toBe(1);
  });

  it("says ALREADY_FRIENDS instead of making a second request", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    await becomeFriends(ada, bayo);
    expect((await m.sendRequest(ada, bayo.id)).status).toBe("ALREADY_FRIENDS");
    expect((await m.sendRequest(bayo, ada.id)).status).toBe("ALREADY_FRIENDS");
    expect(await m.db.friendRequest.count({ where: { status: "PENDING" } })).toBe(0);
  });

  // ---------- Who may act on a request ----------

  it("lets only the person asked accept or reject, and only the sender cancel", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    const chidi = await person("chidi");
    const { requestId } = (await m.sendRequest(ada, bayo.id)) as { requestId: string };

    expect((await failure(m.acceptRequest(ada, requestId))).status).toBe(404);
    expect((await failure(m.acceptRequest(chidi, requestId))).status).toBe(404);
    expect((await failure(m.rejectRequest(ada, requestId))).status).toBe(404);
    expect((await failure(m.rejectRequest(chidi, requestId))).status).toBe(404);
    expect((await failure(m.cancelRequest(bayo, requestId))).status).toBe(404);
    expect((await failure(m.cancelRequest(chidi, requestId))).status).toBe(404);
    expect((await failure(m.acceptRequest(bayo, "no_such_request"))).status).toBe(404);

    const row = await m.db.friendRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(row.status).toBe("PENDING");
    expect(await m.areFriends(ada.id, bayo.id)).toBe(false);
  });

  // ---------- Reject, cancel ----------

  it("never tells the sender about a rejection and holds a new request for seven days", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    const { requestId } = (await m.sendRequest(ada, bayo.id)) as { requestId: string };
    await m.rejectRequest(bayo, requestId);

    const row = await m.db.friendRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(row.status).toBe("REJECTED");
    const wait = (row.retryAfter?.getTime() ?? 0) - Date.now();
    expect(wait).toBeGreaterThan(6.9 * DAY);
    expect(wait).toBeLessThanOrEqual(7 * DAY);
    expect(await notices(ada.id, "FRIEND_REQUEST_ACCEPTED")).toHaveLength(0);

    const blocked = await failure(m.sendRequest(ada, bayo.id));
    expect(blocked).toMatchObject({ status: 409, message: m.errors.friendUnavailable });
    // Declining again is not possible, there is nothing left to decline.
    expect((await failure(m.rejectRequest(bayo, requestId))).status).toBe(404);

    // After the wait the sender may ask again.
    await m.db.friendRequest.update({
      where: { id: requestId },
      data: { retryAfter: new Date(Date.now() - 1000) },
    });
    expect((await m.sendRequest(ada, bayo.id)).status).toBe("SENT");
  });

  it("removes the notice when the sender cancels, and cancelling twice fails", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    const { requestId } = (await m.sendRequest(ada, bayo.id)) as { requestId: string };
    expect(await notices(bayo.id, "FRIEND_REQUEST_RECEIVED")).toHaveLength(1);
    await m.cancelRequest(ada, requestId);
    expect(await notices(bayo.id, "FRIEND_REQUEST_RECEIVED")).toHaveLength(0);
    expect((await failure(m.cancelRequest(ada, requestId))).status).toBe(404);
    expect((await failure(m.acceptRequest(bayo, requestId))).status).toBe(404);
    // A fresh request is possible straight away after a cancel.
    expect((await m.sendRequest(ada, bayo.id)).status).toBe("SENT");
  });

  // ---------- Who can be asked ----------

  it("gives one plain answer for yourself, a missing person, and accounts that cannot be asked", async () => {
    const ada = await person("ada");
    const suspended = await person("sus", { status: "SUSPENDED" });
    const deleted = await person("del", { status: "DELETED" });
    const unfinished = await person("new", { onboardedAt: null });
    for (const id of [ada.id, "no_such_person", suspended.id, deleted.id, unfinished.id]) {
      expect(await failure(m.sendRequest(ada, id))).toMatchObject({
        status: 409,
        message: m.errors.friendUnavailable,
      });
    }
    expect(await m.db.friendRequest.count()).toBe(0);
  });

  // ---------- Block, unfriend ----------

  it("ends the friendship and cancels requests either way on block, and keeps both people apart", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    const chidi = await person("chidi");
    await becomeFriends(ada, bayo);
    const pendingFromChidi = (await m.sendRequest(chidi, ada.id)) as { requestId: string };
    await m.blockUser(ada, bayo.id);
    expect(await m.areFriends(ada.id, bayo.id)).toBe(false);
    expect(await m.isBlockedEitherWay(bayo.id, ada.id)).toBe(true);
    expect(await m.blockedIdsOf(bayo.id)).toEqual([ada.id]);
    expect(await m.friendIdsOf(ada.id)).toEqual([]);

    // Neither side can ask the other, and both get the same plain answer.
    expect((await failure(m.sendRequest(bayo, ada.id))).message).toBe(m.errors.friendUnavailable);
    expect((await failure(m.sendRequest(ada, bayo.id))).message).toBe(m.errors.friendUnavailable);

    // A request waiting between the two people is cancelled by the block.
    await m.blockUser(ada, chidi.id);
    const row = await m.db.friendRequest.findUniqueOrThrow({
      where: { id: pendingFromChidi.requestId },
    });
    expect(row.status).toBe("CANCELLED");

    // The blocker has a line in their activity with an undo.
    const activity = await m.db.notification.findMany({
      where: { userId: ada.id, type: "ACTIVITY" },
    });
    expect(activity.length).toBeGreaterThanOrEqual(2);

    // Accepting a request from someone who has since been blocked is refused.
    await m.unblockUser(ada, bayo.id);
    expect((await m.sendRequest(bayo, ada.id)).status).toBe("SENT");
  });

  it("refuses to block yourself or someone who does not exist, and blocking twice is harmless", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    expect((await failure(m.blockUser(ada, ada.id))).status).toBe(409);
    expect((await failure(m.blockUser(ada, "no_such_person"))).status).toBe(404);
    await m.blockUser(ada, bayo.id);
    await m.blockUser(ada, bayo.id);
    expect(await m.db.block.count()).toBe(1);
    await m.unblockUser(ada, bayo.id);
    await m.unblockUser(ada, bayo.id);
    expect(await m.db.block.count()).toBe(0);
  });

  it("refuses to accept a request when the sender was blocked after sending", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    const { requestId } = (await m.sendRequest(ada, bayo.id)) as { requestId: string };
    // A block made without going through blockUser, so the request is still pending.
    await m.db.block.create({ data: { blockerId: bayo.id, blockedId: ada.id } });
    expect(await failure(m.acceptRequest(bayo, requestId))).toMatchObject({ status: 409 });
    expect(await m.areFriends(ada.id, bayo.id)).toBe(false);
  });

  it("unfriends one person and leaves the others alone", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    const chidi = await person("chidi");
    await becomeFriends(ada, bayo);
    await becomeFriends(ada, chidi);
    await m.unfriend(ada, bayo.id);
    expect(await m.areFriends(ada.id, bayo.id)).toBe(false);
    expect(await m.areFriends(ada.id, chidi.id)).toBe(true);
    expect(await m.friendIdsOf(ada.id)).toEqual([chidi.id]);
    // Unfriending someone who is not a friend does nothing.
    await m.unfriend(ada, bayo.id);
  });

  // ---------- Lists ----------

  it("lists friends by name with their chat, and only people whose accounts are active", async () => {
    const ada = await person("ada", { name: "Ada" });
    const zainab = await person("zainab", { name: "Zainab" });
    const bayo = await person("bayo", { name: "Bayo" });
    const gone = await person("gone", { name: "Gone" });
    await becomeFriends(ada, zainab);
    await becomeFriends(ada, bayo);
    await becomeFriends(ada, gone);
    await m.db.user.update({ where: { id: gone.id }, data: { status: "SUSPENDED" } });

    const list = await m.listFriends(ada);
    expect(list.map((f) => f.user.name)).toEqual(["Bayo", "Zainab"]);
    expect(list.every((f) => f.conversationId !== null)).toBe(true);
    // Nothing in the list gives away an email address.
    expect(JSON.stringify(list)).not.toContain("@example.com");
  });

  it("lists incoming and outgoing requests separately", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    const chidi = await person("chidi");
    await m.sendRequest(bayo, ada.id);
    await m.sendRequest(ada, chidi.id);
    const incoming = await m.listRequests(ada, "INCOMING");
    const outgoing = await m.listRequests(ada, "OUTGOING");
    expect(incoming.map((r) => r.user.username)).toEqual([bayo.username]);
    expect(outgoing.map((r) => r.user.username)).toEqual([chidi.username]);
    expect(incoming[0]?.direction).toBe("INCOMING");
    expect(JSON.stringify([incoming, outgoing])).not.toContain("@example.com");
  });

  // ---------- Limits ----------

  it("refuses the eleventh request in an hour and the thirty first in a day", async () => {
    await waitForWindowRoom(3600, 20_000);
    await waitForWindowRoom(86_400, 20_000);
    const ada = await person("ada");
    const bayo = await person("bayo");
    const { policies, windowStart } = m.limiter;
    const seed = (policy: { name: string; windowSec: number }, count: number) =>
      m.db.rateLimit.create({
        data: {
          key: `${policy.name}:${ada.id}`,
          windowStart: windowStart(new Date(), policy.windowSec),
          count,
        },
      });

    const hour = await seed(policies.friendRequestHour, 10);
    expect(await failure(m.sendRequest(ada, bayo.id))).toMatchObject({
      status: 429,
      message: m.errors.friendLimitHour,
    });
    await m.db.rateLimit.delete({ where: { id: hour.id } });
    await m.db.rateLimit.deleteMany();

    await seed(policies.friendRequestDay, 30);
    expect(await failure(m.sendRequest(ada, bayo.id))).toMatchObject({
      status: 429,
      message: m.errors.friendLimitDay,
    });
    expect(await m.db.friendRequest.count()).toBe(0);
  });

  // ---------- Conversations ----------

  it("makes one chat for two people even when asked at the same moment", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    const ids = await Promise.all([
      m.ensureConversation(ada.id, bayo.id),
      m.ensureConversation(bayo.id, ada.id),
      m.ensureConversation(ada.id, bayo.id),
    ]);
    expect(new Set(ids).size).toBe(1);
    expect(await m.db.conversation.count()).toBe(1);
  });
});
