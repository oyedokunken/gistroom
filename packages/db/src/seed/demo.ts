import { randomBytes, randomUUID } from "node:crypto";
import { TOPICS, slugFromBytes } from "@gistroom/shared";
import type { Message, PrismaClient } from "../generated/client";

/** Everything here is labelled as a demo. Emails use example.com and the bios say so (CLAUDE.md Section 22). */
const DEMO_BIO = "Demo account for development only.";

interface DemoPerson {
  key: string;
  name: string;
  interests: string[];
}

const PEOPLE: DemoPerson[] = [
  { key: "ada", name: "Ada Eze", interests: ["football", "tech-and-startups", "food-and-chop"] },
  { key: "tunde", name: "Tunde Bakare", interests: ["football", "music-and-gbedu", "comedy"] },
  {
    key: "emeka",
    name: "Emeka Obi",
    interests: ["tech-and-startups", "careers-and-jobs", "gaming"],
  },
  {
    key: "zainab",
    name: "Zainab Musa",
    interests: ["fashion-and-owambe", "food-and-chop", "relationships"],
  },
  { key: "chidi", name: "Chidi Okafor", interests: ["politics-and-governance", "football"] },
  {
    key: "ngozi",
    name: "Ngozi Nwosu",
    interests: ["education", "campus-life", "careers-and-jobs"],
  },
  {
    key: "bayo",
    name: "Bayo Adeyemi",
    interests: ["music-and-gbedu", "nollywood-and-entertainment"],
  },
  {
    key: "hauwa",
    name: "Hauwa Bello",
    interests: ["health-and-wellness", "religion-and-spirituality"],
  },
  {
    key: "kemi",
    name: "Kemi Alabi",
    interests: ["diaspora-and-japa", "careers-and-jobs", "business-and-money"],
  },
  { key: "seun", name: "Seun Ogunleye", interests: ["comedy", "gaming", "campus-life"] },
];

const MORE_NAMES = [
  "Funmi Adebayo",
  "Ibrahim Sani",
  "Ifeoma Chukwu",
  "Segun Fashola",
  "Amina Yusuf",
  "Obinna Eze",
  "Titi Balogun",
  "Musa Danjuma",
  "Blessing Etim",
  "Femi Ojo",
  "Halima Garba",
  "Kelechi Nnadi",
  "Yetunde Coker",
  "Dayo Salami",
];
const topicSlugs = TOPICS.map((t) => t.slug);
MORE_NAMES.forEach((name, i) => {
  // Three topics each, walking round the whole list, so every topic ends up with several people.
  const pick = [0, 1, 2].map((k) => topicSlugs[(i * 3 + k * 5) % topicSlugs.length] ?? "open-gist");
  PEOPLE.push({ key: name.split(" ")[0]?.toLowerCase() ?? `p${i}`, name, interests: pick });
});
// The hand written ten only cover some topics, so make sure each remaining one has someone.
topicSlugs.forEach((slug, i) => {
  const taken = PEOPLE.some((p) => p.interests.includes(slug));
  const person = PEOPLE[10 + (i % MORE_NAMES.length)];
  if (!taken && person && !person.interests.includes(slug) && person.interests.length < 8) {
    person.interests.push(slug);
  }
});

const emailFor = (key: string) => `demo.${key}@example.com`;
const orderedPair = (a: string, b: string) => (a < b ? { low: a, high: b } : { low: b, high: a });

export interface DemoSummary {
  users: number;
  friendships: number;
  messages: number;
  rooms: number;
}

/**
 * A small, connected world for the dev schema: people with interests, friends, a pending and a rejected request,
 * one chat with replies, a reaction, a star and notes, public and private rooms, and a call in the log.
 * It is idempotent: running it again leaves what exists alone. Never run it against production.
 */
export async function seedDemo(
  db: PrismaClient,
  passwordHash: string | null,
): Promise<DemoSummary> {
  const now = new Date();
  const ids = new Map<string, string>();

  for (const p of PEOPLE) {
    const user = await db.user.upsert({
      where: { email: emailFor(p.key) },
      create: {
        email: emailFor(p.key),
        emailVerifiedAt: now,
        passwordHash,
        name: p.name,
        username: `demo_${p.key}`,
        bio: DEMO_BIO,
        onboardedAt: now,
        ageConfirmedAt: now,
        termsAcceptedAt: now,
      },
      update: {},
    });
    ids.set(p.key, user.id);
    await db.userInterest.createMany({
      data: p.interests.map((topicSlug) => ({ userId: user.id, topicSlug })),
      skipDuplicates: true,
    });
  }
  const id = (key: string) => ids.get(key) ?? "";

  // Friends: Ada knows Tunde, Emeka and Zainab. Tunde and Bayo are friends too, so mutual friends show up.
  const pairs: [string, string][] = [
    ["ada", "tunde"],
    ["ada", "emeka"],
    ["ada", "zainab"],
    ["tunde", "bayo"],
    ["emeka", "kemi"],
  ];
  const nextYear = new Date(now.getTime() + 365 * 86_400_000);
  for (const [a, b] of pairs) {
    const { low, high } = orderedPair(id(a), id(b));
    await db.friendship.upsert({
      where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
      create: { userLowId: low, userHighId: high, nextAnniversaryAt: nextYear },
      update: {},
    });
  }

  // One request waiting for Ada, and one that was rejected a day ago so the cooldown is visible.
  const pendingExists = await db.friendRequest.count({
    where: { requesterId: id("chidi"), addresseeId: id("ada") },
  });
  if (pendingExists === 0) {
    await db.friendRequest.create({
      data: { requesterId: id("chidi"), addresseeId: id("ada"), status: "PENDING" },
    });
    await db.friendRequest.create({
      data: {
        requesterId: id("seun"),
        addresseeId: id("ada"),
        status: "REJECTED",
        respondedAt: new Date(now.getTime() - 86_400_000),
        retryAfter: new Date(now.getTime() + 6 * 86_400_000),
      },
    });
  }

  // One chat between Ada and Tunde, with a reply, a reaction, a star and a private note.
  const { low, high } = orderedPair(id("ada"), id("tunde"));
  const dmKey = `${low}:${high}`;
  let conversation = await db.conversation.findUnique({ where: { dmKey } });
  let messageCount = 0;
  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        dmKey,
        members: { create: [{ userId: id("ada") }, { userId: id("tunde") }] },
      },
    });
    const script: [string, string][] = [
      ["tunde", "Ada, you watched the match last night?"],
      ["ada", "How far, of course I did. That second half was something."],
      ["tunde", "Let us gist about it in a room tonight."],
      ["ada", "Oya, I will start one at 8."],
    ];
    const base = now.getTime() - script.length * 60_000;
    const created: Message[] = [];
    for (const [i, [who, body]] of script.entries()) {
      created.push(
        await db.message.create({
          data: {
            conversationId: conversation.id,
            senderId: id(who),
            clientId: `seed_${i}_${randomUUID()}`,
            body,
            createdAt: new Date(base + i * 60_000),
            replyToId: i === 3 ? (created[2]?.id ?? null) : null,
          },
        }),
      );
      messageCount += 1;
    }
    const last = created[created.length - 1];
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: last?.createdAt ?? now },
    });
    if (created[1]) {
      await db.messageReaction.create({
        data: { userId: id("tunde"), messageId: created[1].id, emoji: "\u{1F525}" },
      });
      await db.messageStar.create({ data: { userId: id("ada"), messageId: created[1].id } });
    }
    await db.note.create({
      data: {
        userId: id("ada"),
        conversationId: conversation.id,
        body: "Tunde wants a room about last night's match. Start at 8.",
      },
    });
  }

  // Rooms: two live and public, one scheduled, one private. Topics come from the reference seed.
  const topics = new Map((await db.topic.findMany()).map((t) => [t.slug, t.id]));
  const rooms = [
    {
      key: "match",
      host: "tunde",
      title: "Match day gist",
      topic: "football",
      visibility: "PUBLIC" as const,
      status: "SCHEDULED" as const,
      members: ["ada", "chidi", "seun"],
    },
    {
      key: "jollof",
      host: "zainab",
      title: "Jollof or no jollof",
      topic: "food-and-chop",
      visibility: "PUBLIC" as const,
      status: "SCHEDULED" as const,
      members: ["kemi", "hauwa"],
    },
    {
      key: "japa",
      host: "kemi",
      title: "Japa stories, what really happened",
      topic: "diaspora-and-japa",
      visibility: "PUBLIC" as const,
      status: "SCHEDULED" as const,
      members: [],
    },
    {
      key: "friends",
      host: "ada",
      title: "Friends only: weekend plans",
      topic: "relationships",
      visibility: "PRIVATE" as const,
      status: "SCHEDULED" as const,
      members: ["tunde", "zainab"],
    },
  ];
  let roomCount = 0;
  for (const r of rooms) {
    const exists = await db.room.findFirst({ where: { title: r.title, hostId: id(r.host) } });
    if (exists) continue;
    const room = await db.room.create({
      data: {
        slug: slugFromBytes(randomBytes(12)),
        hostId: id(r.host),
        title: r.title,
        topicId: topics.get(r.topic) ?? null,
        description: "Demo room for development only.",
        visibility: r.visibility,
        status: r.status,
        scheduledFor: new Date(now.getTime() + (1 + roomCount) * 86_400_000),
        startedAt: null,
        livekitRoom: `room_${randomUUID()}`,
        members: {
          create: [
            { userId: id(r.host), role: "HOST", state: "INVITED" },
            ...r.members.map((m) => ({
              userId: id(m),
              state: "INVITED" as const,
              joinedAt: null,
            })),
          ],
        },
      },
    });
    roomCount += 1;
    if (r.key === "match") {
      await db.roomMessage.create({
        data: {
          roomId: room.id,
          senderId: id("ada"),
          clientId: `seed_${randomUUID()}`,
          body: "Who is ready for the second half talk?",
        },
      });
      await db.note.create({
        data: {
          userId: id("ada"),
          roomId: room.id,
          body: "Ask Chidi about the transfer rumour.",
        },
      });
    }
  }

  // A finished call between Ada and Tunde, with its log rows for both of them.
  const callExists = await db.call.count({
    where: { callerId: id("ada"), calleeId: id("tunde") },
  });
  if (callExists === 0) {
    const started = new Date(now.getTime() - 3_600_000);
    await db.call.create({
      data: {
        callerId: id("ada"),
        calleeId: id("tunde"),
        initialMedia: "AUDIO",
        status: "ENDED",
        livekitRoom: `call_${randomUUID()}`,
        ringExpiresAt: new Date(started.getTime() + 45_000),
        answeredAt: started,
        endedAt: new Date(started.getTime() + 420_000),
        endReason: "hangup",
      },
    });
    await db.callLogEntry.createMany({
      data: [
        {
          userId: id("ada"),
          kind: "DIRECT",
          direction: "OUTGOING",
          outcome: "ANSWERED",
          mediaType: "AUDIO",
          peerUserId: id("tunde"),
          titleSnapshot: "Tunde Bakare",
          searchText: "tunde bakare demo_tunde",
          startedAt: started,
          durationSec: 420,
        },
        {
          userId: id("tunde"),
          kind: "DIRECT",
          direction: "INCOMING",
          outcome: "ANSWERED",
          mediaType: "AUDIO",
          peerUserId: id("ada"),
          titleSnapshot: "Ada Eze",
          searchText: "ada eze demo_ada",
          startedAt: started,
          durationSec: 420,
        },
      ],
    });
  }

  roomCount += await seedMoreRooms(db, id, now);
  messageCount += await seedMoreChats(db, id, now);
  await seedNotifications(db, id, now);

  await db.notification.upsert({
    where: { userId_dedupeKey: { userId: id("ada"), dedupeKey: "seed:welcome" } },
    create: {
      userId: id("ada"),
      type: "SYSTEM",
      dedupeKey: "seed:welcome",
      payload: { title: "Welcome to the demo", body: "This account was made by the dev seed." },
    },
    update: {},
  });

  return {
    users: PEOPLE.length,
    friendships: pairs.length,
    messages: messageCount,
    rooms: roomCount,
  };
}

type IdOf = (key: string) => string;

/** Scheduled public rooms across the topics, and ended rooms with summary numbers. None of them is live. */
async function seedMoreRooms(db: PrismaClient, id: IdOf, now: Date): Promise<number> {
  const topics = new Map((await db.topic.findMany()).map((t) => [t.slug, t.id]));
  const hosts = PEOPLE.map((p) => p.key);
  let made = 0;
  for (const [i, topic] of topicSlugs.slice(0, 14).entries()) {
    const host = hosts[i % hosts.length] ?? "ada";
    const title = `${TOPICS.find((t) => t.slug === topic)?.name ?? topic}: open gist`;
    if (await db.room.findFirst({ where: { title, hostId: id(host) } })) continue;
    await db.room.create({
      data: {
        slug: slugFromBytes(randomBytes(12)),
        hostId: id(host),
        title,
        topicId: topics.get(topic) ?? null,
        description: "Demo room for development only.",
        language: (["ENGLISH", "PIDGIN", "YORUBA", "IGBO", "HAUSA"] as const)[i % 5] ?? "ENGLISH",
        media: i % 3 === 0 ? "VIDEO" : "AUDIO",
        status: "SCHEDULED",
        scheduledFor: new Date(now.getTime() + (3 + i * 5) * 3_600_000),
        livekitRoom: `room_${randomUUID()}`,
        members: { create: { userId: id(host), role: "HOST", state: "INVITED" } },
      },
    });
    made += 1;
  }

  const ended = [
    {
      host: "ada",
      title: "Last night's match, the full gist",
      topic: "football",
      guests: ["tunde", "chidi", "seun", "emeka"],
      peak: 4,
      messages: 38,
      reactions: 21,
    },
    {
      host: "zainab",
      title: "Owambe season planning",
      topic: "fashion-and-owambe",
      guests: ["kemi", "hauwa"],
      peak: 3,
      messages: 17,
      reactions: 9,
    },
    {
      host: "emeka",
      title: "Getting your first tech job",
      topic: "careers-and-jobs",
      guests: ["ngozi", "kemi", "ada"],
      peak: 4,
      messages: 52,
      reactions: 30,
    },
    {
      host: "tunde",
      title: "Gbedu hour: what is on repeat",
      topic: "music-and-gbedu",
      guests: ["bayo", "ada"],
      peak: 3,
      messages: 24,
      reactions: 14,
    },
  ];
  for (const [i, r] of ended.entries()) {
    if (await db.room.findFirst({ where: { title: r.title, hostId: id(r.host) } })) continue;
    const started = new Date(now.getTime() - (i + 1) * 2 * 86_400_000);
    const stopped = new Date(started.getTime() + (45 + i * 20) * 60_000);
    await db.room.create({
      data: {
        slug: slugFromBytes(randomBytes(12)),
        hostId: id(r.host),
        title: r.title,
        topicId: topics.get(r.topic) ?? null,
        description: "Demo room for development only.",
        status: "ENDED",
        startedAt: started,
        endedAt: stopped,
        peakParticipants: r.peak,
        messageCount: r.messages,
        reactionCount: r.reactions,
        livekitRoom: `room_${randomUUID()}`,
        members: {
          create: [
            { userId: id(r.host), role: "HOST", state: "LEFT", joinedAt: started, leftAt: stopped },
            ...r.guests.map((g) => ({
              userId: id(g),
              state: "LEFT" as const,
              joinedAt: started,
              leftAt: stopped,
            })),
          ],
        },
      },
    });
    made += 1;
  }
  return made;
}

/** A second chat with edits, a deleted message, an image and a voice note, kept archived, plus a starred message. */
async function seedMoreChats(db: PrismaClient, id: IdOf, now: Date): Promise<number> {
  const a = id("ada");
  const b = id("emeka");
  const { low, high } = orderedPair(a, b);
  const dmKey = `${low}:${high}`;
  if (await db.conversation.findUnique({ where: { dmKey } })) return 0;
  const convo = await db.conversation.create({
    data: {
      dmKey,
      members: { create: [{ userId: a, archivedAt: now }, { userId: b }] },
    },
  });
  const t = (min: number) => new Date(now.getTime() - min * 60_000);
  const mk = (who: string, body: string | null, min: number, extra: Record<string, unknown> = {}) =>
    db.message.create({
      data: {
        conversationId: convo.id,
        senderId: id(who),
        clientId: `seed_${randomUUID()}`,
        body,
        createdAt: t(min),
        ...extra,
      },
    });
  const first = await mk("emeka", "Did you see the new job post?", 120);
  const edited = await mk("ada", "Yes, I will apply tonight.", 110, { editedAt: t(108) });
  await mk("emeka", "Sent this by mistake", 100, { deletedForEveryoneAt: t(99) });
  await mk("emeka", "Here is the screenshot.", 90, { type: "IMAGE" }).then((m) =>
    db.messageAttachment.create({
      data: {
        messageId: m.id,
        storagePath: "demo/placeholder-image",
        mime: "image/jpeg",
        sizeBytes: 120_000,
        width: 1200,
        height: 800,
      },
    }),
  );
  await mk("ada", null, 80, { type: "VOICE" }).then((m) =>
    db.messageAttachment.create({
      data: {
        messageId: m.id,
        storagePath: "demo/placeholder-voice",
        mime: "audio/webm",
        sizeBytes: 40_000,
        durationMs: 12_000,
        waveform: Array.from({ length: 64 }, (_, i) => 10 + ((i * 37) % 80)),
      },
    }),
  );
  const last = await mk("emeka", "Perfect, call me tomorrow.", 70);
  await db.messageReaction.create({
    data: { userId: b, messageId: edited.id, emoji: "\u{1F44F}" },
  });
  await db.messageStar.create({ data: { userId: a, messageId: first.id } });
  await db.conversation.update({
    where: { id: convo.id },
    data: { lastMessageAt: last.createdAt },
  });
  return 6;
}

/** One notification of every type for Ada, so the Notifications page has something of each kind. */
async function seedNotifications(db: PrismaClient, id: IdOf, now: Date): Promise<void> {
  const ada = id("ada");
  const room = await db.room.findFirst({ where: { hostId: id("tunde") } });
  const rows: { key: string; type: string; payload: Record<string, unknown>; read?: boolean }[] = [
    {
      key: "friend-request",
      type: "FRIEND_REQUEST_RECEIVED",
      payload: { fromName: "Chidi Okafor", fromUsername: "demo_chidi" },
    },
    {
      key: "friend-accepted",
      type: "FRIEND_REQUEST_ACCEPTED",
      payload: { name: "Zainab Musa" },
      read: true,
    },
    {
      key: "dm",
      type: "DM_MESSAGE",
      payload: { fromName: "Tunde Bakare", preview: "You coming tonight?", count: 2 },
    },
    { key: "missed", type: "CALL_MISSED", payload: { fromName: "Emeka Obi" } },
    {
      key: "invite",
      type: "ROOM_INVITE",
      payload: {
        fromName: "Tunde Bakare",
        roomTitle: "Match day gist",
        roomSlug: room?.slug ?? "",
      },
    },
    {
      key: "starting",
      type: "ROOM_STARTING",
      payload: { roomTitle: "Match day gist", roomSlug: room?.slug ?? "" },
    },
    {
      key: "role",
      type: "ROOM_ROLE_CHANGED",
      payload: { role: "moderator", roomTitle: "Match day gist", roomSlug: room?.slug ?? "" },
      read: true,
    },
    {
      key: "ended",
      type: "ROOM_ENDED",
      payload: { roomTitle: "Last night's match, the full gist", roomSlug: room?.slug ?? "" },
      read: true,
    },
    {
      key: "device",
      type: "SECURITY_NEW_DEVICE",
      payload: { device: "Chrome on Windows" },
      read: true,
    },
    { key: "report", type: "REPORT_UPDATE", payload: {}, read: true },
  ];
  for (const r of rows) {
    await db.notification.upsert({
      where: { userId_dedupeKey: { userId: ada, dedupeKey: `seed:${r.key}` } },
      create: {
        userId: ada,
        type: r.type,
        dedupeKey: `seed:${r.key}`,
        payload: r.payload as never,
        readAt: r.read ? now : null,
      },
      update: {},
    });
  }
  await db.notification.upsert({
    where: { userId_dedupeKey: { userId: ada, dedupeKey: "seed:activity" } },
    create: {
      userId: ada,
      type: "ACTIVITY",
      dedupeKey: "seed:activity",
      readAt: now,
      expiresAt: new Date(now.getTime() + 7 * 86_400_000),
      payload: { kind: "room-started", text: 'You scheduled "Match day gist".' },
    },
    update: {},
  });
}
