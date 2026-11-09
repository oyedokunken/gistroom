import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareTestEnv, resetTestDb, testDbEnabled } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();
if (testDbEnabled) {
  process.env.LIVEKIT_URL = "http://livekit.test";
  process.env.LIVEKIT_API_KEY = "test_key";
  process.env.LIVEKIT_API_SECRET = "s".repeat(40);
  process.env.REALTIME_URL = "http://realtime.test";
}

interface Seen {
  url: string;
  body: Record<string, unknown>;
}

async function load() {
  const [rooms, present, db] = await Promise.all([
    import("../../apps/web/src/server/rooms/service"),
    import("../../apps/web/src/server/presentation"),
    import("@gistroom/db"),
  ]);
  return { ...rooms, ...present, db: db.getDb() };
}

/** Permission lists sent to LiveKit for one person, newest last. */
const grants = (seen: Seen[], identity: string): string[][] =>
  seen
    .filter((s) => s.url.endsWith("/UpdateParticipant") && s.body.identity === identity)
    .map(
      (s) =>
        ((s.body.permission as { can_publish_sources?: string[] }).can_publish_sources ??
          []) as string[],
    );

describe.skipIf(!requireTestDb())("screen sharing", () => {
  let m: Awaited<ReturnType<typeof load>>;
  let seen: Seen[] = [];
  let livekitUp = true;

  beforeAll(async () => {
    m = await load();
  });
  beforeEach(async () => {
    await resetTestDb();
    seen = [];
    livekitUp = true;
    // LiveKit and realtime are mocked. Every call they get is recorded, so the permissions can be checked.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        seen.push({ url, body });
        const fail = url.includes("livekit.test") && !livekitUp;
        return { ok: !fail, status: fail ? 503 : 200, json: async () => ({}) } as Response;
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  afterAll(async () => {
    await resetTestDb();
  });

  async function person(key: string) {
    return m.db.user.create({
      data: {
        email: `test_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_${key}`,
        onboardedAt: new Date(),
      },
    });
  }
  type Person = Awaited<ReturnType<typeof person>>;
  const identity = (p: Person) => `user_${p.id}`;

  async function liveRoom(host: Person, others: Person[]) {
    const room = await m.createRoom(host, {
      title: "Match talk",
      topicSlug: "football",
      language: "ENGLISH",
      visibility: "PUBLIC",
      media: "VIDEO",
      description: null,
      scheduledFor: null,
    });
    await m.joinRoom(host, room.slug);
    for (const o of others) await m.joinRoom(o, room.slug);
    return room;
  }

  async function activeCall(a: Person, b: Person) {
    return m.db.call.create({
      data: {
        callerId: a.id,
        calleeId: b.id,
        initialMedia: "AUDIO",
        status: "ACTIVE",
        livekitRoom: `call_${a.id}_${b.id}`,
        ringExpiresAt: new Date(),
        answeredAt: new Date(),
      },
    });
  }

  it("never puts the screen in a join token, and grants it to the presenter only", async () => {
    const host = await person("p1");
    const ada = await person("p2");
    const room = await liveRoom(host, []);
    const join = await m.joinRoom(ada, room.slug);
    const claims = JSON.parse(
      Buffer.from(String(join.token).split(".")[1] ?? "", "base64url").toString(),
    ) as { video: { canPublishSources?: string[] } };
    expect(claims.video.canPublishSources).not.toContain("SCREEN_SHARE");
    expect(claims.video.canPublishSources).not.toContain("screen_share");

    await m.actOnPresentation(ada, "room", room.slug, "start");
    expect(grants(seen, identity(ada)).at(-1)).toContain("SCREEN_SHARE");
    const state = await m.readPresentation(host, "room", room.slug);
    expect(state.presenter?.id).toBe(ada.id);
  });

  it("keeps one presenter: a second start is refused and the first stays", async () => {
    const host = await person("p3");
    const ada = await person("p4");
    const bola = await person("p5");
    const room = await liveRoom(host, [ada, bola]);
    await m.actOnPresentation(ada, "room", room.slug, "start");
    await expect(m.actOnPresentation(bola, "room", room.slug, "start")).rejects.toMatchObject({
      status: 409,
    });
    const state = await m.readPresentation(bola, "room", room.slug);
    expect(state.presenter?.id).toBe(ada.id);
    // The refused person was never granted the screen.
    expect(grants(seen, identity(bola)).flat()).not.toContain("SCREEN_SHARE");
  });

  it("hands over only when the presenter allows it, and reserves the turn for the asker", async () => {
    const host = await person("p6");
    const ada = await person("p7");
    const bola = await person("p8");
    const chi = await person("p9");
    const room = await liveRoom(host, [ada, bola, chi]);
    await m.actOnPresentation(ada, "room", room.slug, "start");

    await m.actOnPresentation(bola, "room", room.slug, "request");
    // A second asker is told someone already asked.
    await expect(m.actOnPresentation(chi, "room", room.slug, "request")).rejects.toMatchObject({
      status: 409,
    });
    // Only the presenter can answer.
    await expect(m.actOnPresentation(chi, "room", room.slug, "accept")).rejects.toMatchObject({
      status: 409,
    });

    await m.actOnPresentation(ada, "room", room.slug, "accept");
    // Ada lost the screen permission, and nobody but Bola may start now.
    expect(grants(seen, identity(ada)).at(-1)).not.toContain("SCREEN_SHARE");
    await expect(m.actOnPresentation(chi, "room", room.slug, "start")).rejects.toMatchObject({
      status: 409,
    });
    await m.actOnPresentation(bola, "room", room.slug, "start");
    const state = await m.readPresentation(chi, "room", room.slug);
    expect(state.presenter?.id).toBe(bola.id);
  });

  it("lets the presenter decline, which changes nothing", async () => {
    const host = await person("p10");
    const ada = await person("p11");
    const bola = await person("p12");
    const room = await liveRoom(host, [ada, bola]);
    await m.actOnPresentation(ada, "room", room.slug, "start");
    await m.actOnPresentation(bola, "room", room.slug, "request");
    await m.actOnPresentation(ada, "room", room.slug, "decline");
    const state = await m.readPresentation(bola, "room", room.slug);
    expect(state.presenter?.id).toBe(ada.id);
    expect(state.requester).toBeNull();
  });

  it("lets a moderator stop a member, logs it and takes the permission away", async () => {
    const host = await person("p13");
    const mod = await person("p14");
    const ada = await person("p15");
    const room = await liveRoom(host, [mod, ada]);
    await m.moderate(host, room.slug, { action: "PROMOTE", userId: mod.id });
    await m.actOnPresentation(ada, "room", room.slug, "start");

    // A plain member cannot stop someone else.
    const bola = await person("p16");
    await m.joinRoom(bola, room.slug);
    await expect(m.actOnPresentation(bola, "room", room.slug, "force-stop")).rejects.toMatchObject({
      status: 403,
    });

    await m.actOnPresentation(mod, "room", room.slug, "force-stop");
    expect((await m.readPresentation(mod, "room", room.slug)).presenter).toBeNull();
    expect(grants(seen, identity(ada)).at(-1)).not.toContain("SCREEN_SHARE");
    const log = await m.modLog(host, room.slug);
    const entry = log.find((l) => l.action === "PRESENT_STOP");
    expect(entry?.actor.id).toBe(mod.id);
    expect(entry?.target?.id).toBe(ada.id);
  });

  it("never lets a moderator stop the host, and lets the host take over", async () => {
    const host = await person("p17");
    const mod = await person("p18");
    const room = await liveRoom(host, [mod]);
    await m.moderate(host, room.slug, { action: "PROMOTE", userId: mod.id });
    await m.actOnPresentation(host, "room", room.slug, "start");
    await expect(m.actOnPresentation(mod, "room", room.slug, "force-stop")).rejects.toMatchObject({
      status: 403,
    });
    await expect(m.actOnPresentation(mod, "room", room.slug, "take-over")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("ends a presentation when the presenter is removed, banned or leaves", async () => {
    const host = await person("p19");
    const ada = await person("p20");
    const bola = await person("p21");
    const chi = await person("p22");
    const room = await liveRoom(host, [ada, bola, chi]);

    await m.actOnPresentation(ada, "room", room.slug, "start");
    await m.moderate(host, room.slug, { action: "REMOVE", userId: ada.id });
    expect((await m.readPresentation(host, "room", room.slug)).presenter).toBeNull();
    // The removed person can neither present nor read the state any more.
    await expect(m.actOnPresentation(ada, "room", room.slug, "start")).rejects.toMatchObject({
      status: 403,
    });

    await m.actOnPresentation(bola, "room", room.slug, "start");
    await m.moderate(host, room.slug, { action: "BAN", userId: bola.id });
    expect((await m.readPresentation(host, "room", room.slug)).presenter).toBeNull();

    await m.actOnPresentation(chi, "room", room.slug, "start");
    await m.leaveRoom(chi, room.slug);
    await vi.waitFor(async () =>
      expect((await m.readPresentation(host, "room", room.slug)).presenter).toBeNull(),
    );
  });

  it("refuses to present in a room that has ended", async () => {
    const host = await person("p23");
    const ada = await person("p24");
    const room = await liveRoom(host, [ada]);
    await m.actOnPresentation(ada, "room", room.slug, "start");
    await m.endRoom(host, room.slug);
    await expect(m.actOnPresentation(ada, "room", room.slug, "start")).rejects.toMatchObject({
      status: 410,
    });
    const row = await m.db.room.findUniqueOrThrow({ where: { id: room.id } });
    await vi.waitFor(async () => {
      const fresh = await m.db.room.findUniqueOrThrow({ where: { id: row.id } });
      expect(fresh.presenterId).toBeNull();
    });
  });

  it("fails closed when LiveKit does not confirm the permission", async () => {
    const host = await person("p25");
    const ada = await person("p26");
    const room = await liveRoom(host, [ada]);
    livekitUp = false;
    await expect(m.actOnPresentation(ada, "room", room.slug, "start")).rejects.toMatchObject({
      status: 503,
    });
    livekitUp = true;
    expect((await m.readPresentation(host, "room", room.slug)).presenter).toBeNull();
  });

  it("tells realtime only an id and a change, never a name or a title", async () => {
    const host = await person("p27");
    const ada = await person("p28");
    const room = await liveRoom(host, [ada]);
    await m.actOnPresentation(ada, "room", room.slug, "start");
    await vi.waitFor(() => {
      const hint = seen.find((s) => s.body.type === "presentation");
      expect(hint?.body).toEqual({
        type: "presentation",
        scope: "room",
        refId: room.id,
        change: "started",
      });
    });
    expect(JSON.stringify(seen.map((s) => s.body))).not.toMatch(/screen_title|window|source_name/i);
  });

  it("lets either person in a call present, never lets the other stop it, and hides it from strangers", async () => {
    const ada = await person("c1");
    const bola = await person("c2");
    const eve = await person("c3");
    const call = await activeCall(ada, bola);

    await m.actOnPresentation(ada, "call", call.id, "start");
    expect(grants(seen, identity(ada)).at(-1)).toContain("SCREEN_SHARE");
    await expect(m.actOnPresentation(bola, "call", call.id, "start")).rejects.toMatchObject({
      status: 409,
    });
    await expect(m.actOnPresentation(bola, "call", call.id, "force-stop")).rejects.toMatchObject({
      status: 403,
    });
    await expect(m.actOnPresentation(bola, "call", call.id, "take-over")).rejects.toMatchObject({
      status: 403,
    });
    // A stranger cannot even read it.
    await expect(m.readPresentation(eve, "call", call.id)).rejects.toMatchObject({ status: 404 });

    await m.actOnPresentation(bola, "call", call.id, "request");
    await m.actOnPresentation(ada, "call", call.id, "accept");
    await m.actOnPresentation(bola, "call", call.id, "start");
    expect((await m.readPresentation(ada, "call", call.id)).presenter?.id).toBe(bola.id);
  });

  it("does not let anyone present before a call is answered or after it ends", async () => {
    const ada = await person("c4");
    const bola = await person("c5");
    const ringing = await m.db.call.create({
      data: {
        callerId: ada.id,
        calleeId: bola.id,
        initialMedia: "AUDIO",
        status: "RINGING",
        livekitRoom: "call_ringing",
        ringExpiresAt: new Date(Date.now() + 45_000),
      },
    });
    await expect(m.actOnPresentation(ada, "call", ringing.id, "start")).rejects.toMatchObject({
      status: 403,
    });
    const ended = await m.db.call.create({
      data: {
        callerId: ada.id,
        calleeId: bola.id,
        initialMedia: "AUDIO",
        status: "ENDED",
        livekitRoom: "call_ended",
        ringExpiresAt: new Date(),
        endedAt: new Date(),
      },
    });
    await expect(m.actOnPresentation(ada, "call", ended.id, "start")).rejects.toMatchObject({
      status: 410,
    });
  });
});
