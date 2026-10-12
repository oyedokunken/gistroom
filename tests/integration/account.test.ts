import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb, testDbEnabled } from "../helpers/db";

prepareTestEnv();

async function load() {
  const [account, pw, mail, db] = await Promise.all([
    import("../../apps/web/src/server/account/service"),
    import("../../apps/web/src/server/auth/password"),
    import("../../apps/web/src/server/mail/transport"),
    import("@gistroom/db"),
  ]);
  return { ...account, hashPassword: pw.hashPassword, captured: mail.capturedMail, db: db.getDb() };
}

function lastCode(captured: { to: string; text: string }[], to: string): string {
  const msg = [...captured].reverse().find((m) => m.to === to && /Your code:/.test(m.text));
  const match = /Your code: (\d{6})/.exec(msg?.text ?? "");
  if (!match?.[1]) throw new Error("no code captured");
  return match[1];
}

const PASSWORD = "a long enough passphrase";

describe.skipIf(!testDbEnabled)("account settings", () => {
  let m: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    m = await load();
  });
  beforeEach(async () => {
    await resetTestDb();
    m.captured.length = 0;
  });
  afterAll(async () => {
    await resetTestDb();
  });

  async function person(key: string) {
    return m.db.user.create({
      data: {
        email: `test_${key}@example.com`,
        emailVerifiedAt: new Date(),
        passwordHash: await m.hashPassword(PASSWORD),
        name: `Test ${key}`,
        username: `test_${key}`,
        onboardedAt: new Date(),
      },
    });
  }

  it("changes the username and refuses one that is taken", async () => {
    const a = await person("a1");
    await person("a2");
    const updated = await m.changeUsername(a, "fresh_name");
    expect(updated.username).toBe("fresh_name");
    await expect(m.changeUsername(updated, "test_a2")).rejects.toMatchObject({ status: 409 });
  });

  it("changes the email with a code sent to the new address, and tells the old one", async () => {
    const u = await person("e1");
    const session = await m.db.session.create({
      data: { userId: u.id, tokenHash: "keep", expiresAt: new Date(Date.now() + 1e6) },
    });
    await m.db.session.create({
      data: { userId: u.id, tokenHash: "other", expiresAt: new Date(Date.now() + 1e6) },
    });
    await expect(
      m.startEmailChange(
        u,
        { newEmail: "new_e1@example.com", password: "wrong wrong wrong" },
        "10.1.0.1",
      ),
    ).rejects.toMatchObject({ status: 400 });
    await m.startEmailChange(u, { newEmail: "new_e1@example.com", password: PASSWORD }, "10.1.0.1");
    expect(m.captured.some((x) => x.to === "new_e1@example.com")).toBe(true);
    const updated = await m.confirmEmailChange(
      u,
      session.id,
      { newEmail: "new_e1@example.com", code: lastCode(m.captured, "new_e1@example.com") },
      "10.1.0.1",
    );
    expect(updated.email).toBe("new_e1@example.com");
    expect(
      m.captured.some((x) => x.to === "test_e1@example.com" && /changed/i.test(x.subject)),
    ).toBe(true);
    expect(await m.db.session.count({ where: { userId: u.id, revokedAt: null } })).toBe(1);
  });

  it("will not move an email onto an address another account uses", async () => {
    const a = await person("e2");
    await person("e3");
    await expect(
      m.startEmailChange(a, { newEmail: "test_e3@example.com", password: PASSWORD }, "10.1.0.2"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      m.startEmailChange(a, { newEmail: "test_e2@example.com", password: PASSWORD }, "10.1.0.2"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("exports only the person's own data", async () => {
    const a = await person("x1");
    const b = await person("x2");
    await m.db.userInterest.createMany({
      data: ["football", "comedy", "gaming"].map((topicSlug) => ({ userId: a.id, topicSlug })),
    });
    const conversation = await m.db.conversation.create({
      data: { dmKey: `${a.id}:${b.id}`, members: { create: [{ userId: a.id }, { userId: b.id }] } },
    });
    await m.db.message.create({
      data: { conversationId: conversation.id, senderId: a.id, clientId: "c1", body: "mine" },
    });
    await m.db.message.create({
      data: { conversationId: conversation.id, senderId: b.id, clientId: "c2", body: "theirs" },
    });
    await m.db.note.create({
      data: { userId: a.id, conversationId: conversation.id, body: "note a" },
    });
    await m.db.note.create({
      data: { userId: b.id, conversationId: conversation.id, body: "note b" },
    });
    const data = await m.buildExport(a);
    expect(data.profile.email).toBe(a.email);
    expect(data.interests).toHaveLength(3);
    expect(data.messagesYouSent.map((x) => x.body)).toEqual(["mine"]);
    expect(data.notes.map((x) => x.body)).toEqual(["note a"]);
    expect(JSON.stringify(data)).not.toContain("theirs");
    expect(JSON.stringify(data)).not.toContain("note b");
  });

  it("deletes an account only with the code, anonymises it and frees the email", async () => {
    const a = await person("d1");
    const b = await person("d2");
    const conversation = await m.db.conversation.create({
      data: { dmKey: `${a.id}:${b.id}`, members: { create: [{ userId: a.id }, { userId: b.id }] } },
    });
    await m.db.message.create({
      data: { conversationId: conversation.id, senderId: a.id, clientId: "d", body: "hello" },
    });
    await m.db.session.create({
      data: { userId: a.id, tokenHash: "d1", expiresAt: new Date(Date.now() + 1e6) },
    });
    await m.startAccountDeletion(a, "10.1.0.3");
    await expect(
      m.confirmAccountDeletion(a, { code: "000000", password: PASSWORD }, "10.1.0.3"),
    ).rejects.toMatchObject({ status: 400 });
    expect((await m.db.user.findUnique({ where: { id: a.id } }))?.status).toBe("ACTIVE");
    await m.confirmAccountDeletion(
      a,
      { code: lastCode(m.captured, a.email), password: PASSWORD },
      "10.1.0.3",
    );
    const gone = await m.db.user.findUnique({ where: { id: a.id } });
    expect(gone?.status).toBe("DELETED");
    expect(gone?.name).toBe("Deleted user");
    expect(gone?.email).not.toBe("test_d1@example.com");
    expect(await m.db.session.count({ where: { userId: a.id } })).toBe(0);
    // The chat is still there for the other person, and the message stays.
    expect(await m.db.message.count({ where: { conversationId: conversation.id } })).toBe(1);
    expect(
      m.captured.some((x) => x.to === "test_d1@example.com" && /deleted/i.test(x.subject)),
    ).toBe(true);
  });
});
