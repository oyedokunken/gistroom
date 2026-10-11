import { randomBytes, randomUUID } from "node:crypto";
import { slugFromBytes } from "@gistroom/shared";
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
  { key: "hauwa", name: "Hauwa Bello", interests: ["health-and-wellness", "faith-and-life"] },
  {
    key: "kemi",
    name: "Kemi Alabi",
    interests: ["diaspora-and-japa", "careers-and-jobs", "business-and-money"],
  },
  { key: "seun", name: "Seun Ogunleye", interests: ["comedy", "gaming", "campus-life"] },
];

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
      status: "LIVE" as const,
      members: ["ada", "chidi", "seun"],
    },
    {
      key: "jollof",
      host: "zainab",
      title: "Jollof or no jollof",
      topic: "food-and-chop",
      visibility: "PUBLIC" as const,
      status: "LIVE" as const,
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
      status: "LIVE" as const,
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
        scheduledFor: r.status === "SCHEDULED" ? new Date(now.getTime() + 2 * 86_400_000) : null,
        startedAt: r.status === "LIVE" ? now : null,
        livekitRoom: `room_${randomUUID()}`,
        members: {
          create: [
            { userId: id(r.host), role: "HOST", state: "JOINED", joinedAt: now },
            ...r.members.map((m) => ({
              userId: id(m),
              state: r.status === "LIVE" ? ("JOINED" as const) : ("INVITED" as const),
              joinedAt: r.status === "LIVE" ? now : null,
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
