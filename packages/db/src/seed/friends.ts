import { randomBytes, randomUUID } from "node:crypto";
import { slugFromBytes } from "@gistroom/shared";
import type { PrismaClient } from "../generated/client";

/**
 * A targeted test world around one real account (the prime test user) and, optionally, a second one. Thirty
 * Nigerian people with real sounding names, their gist, their rooms and their calls, all marked `isSeed` so one
 * command removes every trace of them before launch. Seeded profiles have natural bios and are marked `isSeed` internally.
 * Seeded people never log in and are never emailed.
 */

interface Person {
  first: string;
  last: string;
  city: string;
  interests: string[];
  bio: string;
  /** Minutes since they were last on. 0 means active now. */
  seen: number;
  domain: "gmail.com" | "yahoo.com";
  /** Who they are friends with: the prime user, the second user, both. */
  with?: "felix" | "second" | "both";
}

const P = (
  first: string,
  last: string,
  city: string,
  interests: string[],
  bio: string,
  seen: number,
  domain: Person["domain"],
  withWhom?: Person["with"],
): Person => ({ first, last, city, interests, bio, seen, domain, with: withWhom });

export const PEOPLE: Person[] = [
  // Friends of the prime user, with chats
  P(
    "Adaeze",
    "Okonkwo",
    "Enugu",
    ["football", "music-and-gbedu", "food-and-chop"],
    "Arsenal till I die. Weekend jollof judge.",
    0,
    "gmail.com",
    "felix",
  ),
  P(
    "Tunde",
    "Bakare",
    "Lagos",
    ["tech-and-startups", "business-and-money", "football"],
    "Building in Yaba. Product person.",
    2,
    "yahoo.com",
    "felix",
  ),
  P(
    "Chidi",
    "Eze",
    "Port Harcourt",
    ["politics-and-governance", "football", "news-and-current-affairs"],
    "I follow the news so you do not have to.",
    14,
    "gmail.com",
    "felix",
  ),
  P(
    "Zainab",
    "Musa",
    "Kano",
    ["fashion-and-owambe", "food-and-chop", "relationships"],
    "Tailor. Owambe season is my busy season.",
    55,
    "gmail.com",
    "felix",
  ),
  P(
    "Bayo",
    "Adeyemi",
    "Ibadan",
    ["music-and-gbedu", "nollywood-and-movies", "comedy"],
    "Fuji, afrobeats and a good Nollywood plot.",
    180,
    "yahoo.com",
    "felix",
  ),
  P(
    "Ngozi",
    "Nwosu",
    "Abuja",
    ["careers-and-jobs", "education", "diaspora-and-japa"],
    "HR by day. Helping people japa right.",
    1,
    "gmail.com",
    "felix",
  ),
  P(
    "Ibrahim",
    "Sani",
    "Kaduna",
    ["football", "religion-and-spirituality", "agriculture"],
    "Farm, faith, football. In that order.",
    320,
    "gmail.com",
    "felix",
  ),
  P(
    "Funmi",
    "Adebayo",
    "Abeokuta",
    ["relationships", "marriage-and-family", "parenting"],
    "Mum of two. Marriage counsellor on the side.",
    28,
    "yahoo.com",
    "felix",
  ),
  P(
    "Emeka",
    "Obi",
    "Onitsha",
    ["business-and-money", "crypto-and-fintech", "real-estate-and-housing"],
    "Trader turned investor. Ask me about land.",
    4,
    "gmail.com",
    "both",
  ),
  P(
    "Kemi",
    "Alabi",
    "Lagos",
    ["diaspora-and-japa", "careers-and-jobs", "travel-and-tourism"],
    "Moved to Toronto in 2025. Ask me anything about the journey.",
    600,
    "gmail.com",
    "both",
  ),
  // Friends of the second user
  P(
    "Seun",
    "Ogunleye",
    "Lagos",
    ["comedy", "gaming", "campus-life"],
    "Skit maker. Still has a UNILAG hostel story.",
    7,
    "yahoo.com",
    "second",
  ),
  P(
    "Hauwa",
    "Bello",
    "Maiduguri",
    ["health-and-wellness", "religion-and-spirituality", "education"],
    "Nurse. Wellness tips that actually work.",
    90,
    "gmail.com",
    "second",
  ),
  P(
    "Obinna",
    "Nnadi",
    "Awka",
    ["tech-and-startups", "science-and-innovation", "gaming"],
    "Backend developer. Solar is my other hobby.",
    3,
    "gmail.com",
    "second",
  ),
  P(
    "Halima",
    "Garba",
    "Katsina",
    ["books-and-reading", "history-and-heritage", "culture-and-tradition"],
    "Reads everything. Hausa history nerd.",
    1500,
    "gmail.com",
    "second",
  ),
  P(
    "Femi",
    "Ojo",
    "Ilorin",
    ["football", "other-sports", "music-and-gbedu"],
    "Sports journalist. Super Eagles forever.",
    12,
    "yahoo.com",
    "second",
  ),
  // Others: requests, suggestions, room hosts
  P(
    "Blessing",
    "Etim",
    "Uyo",
    ["food-and-chop", "culture-and-tradition", "travel-and-tourism"],
    "Efik cuisine ambassador. Edikang Ikong for life.",
    0,
    "gmail.com",
  ),
  P(
    "Kelechi",
    "Nnamdi",
    "Owerri",
    ["football", "business-and-money", "politics-and-governance"],
    "Imo boy. Politics and match day.",
    45,
    "yahoo.com",
  ),
  P(
    "Yetunde",
    "Coker",
    "Lagos",
    ["fashion-and-owambe", "art-and-photography", "entertainment-and-pop-culture"],
    "Photographer. Weddings and street portraits.",
    5,
    "gmail.com",
  ),
  P(
    "Dayo",
    "Salami",
    "Ibadan",
    ["campus-life", "education", "careers-and-jobs"],
    "Final year student at UI. NYSC next.",
    22,
    "gmail.com",
  ),
  P(
    "Amina",
    "Yusuf",
    "Abuja",
    ["law-and-justice", "politics-and-governance", "news-and-current-affairs"],
    "Lawyer. Know your rights, Nigeria.",
    130,
    "yahoo.com",
  ),
  P(
    "Chinedu",
    "Okeke",
    "Lagos",
    ["crypto-and-fintech", "tech-and-startups", "business-and-money"],
    "Fintech analyst. USDT and naira, I follow both.",
    9,
    "gmail.com",
  ),
  P(
    "Folake",
    "Adeniran",
    "Lagos",
    ["marriage-and-family", "parenting", "health-and-wellness"],
    "Doctor and mum. Naptime is sacred.",
    240,
    "gmail.com",
  ),
  P(
    "Usman",
    "Abdullahi",
    "Kano",
    ["football", "agriculture", "religion-and-spirituality"],
    "Rice farmer. Kano Pillars supporter.",
    70,
    "yahoo.com",
  ),
  P(
    "Ifeoma",
    "Chukwu",
    "Nsukka",
    ["books-and-reading", "campus-life", "science-and-innovation"],
    "UNN lecturer. Stories and science.",
    33,
    "gmail.com",
  ),
  P(
    "Segun",
    "Fashola",
    "Lagos",
    ["music-and-gbedu", "entertainment-and-pop-culture", "comedy"],
    "DJ. Amapiano on Fridays, highlife on Sundays.",
    2,
    "gmail.com",
  ),
  P(
    "Titi",
    "Balogun",
    "Lagos",
    ["real-estate-and-housing", "business-and-money", "relationships"],
    "Estate agent. Lekki and Ajah.",
    400,
    "yahoo.com",
  ),
  P(
    "Musa",
    "Danjuma",
    "Jos",
    ["other-sports", "football", "history-and-heritage"],
    "Jos plateau boy. Table tennis and old football stories.",
    15,
    "gmail.com",
  ),
  P(
    "Tolani",
    "Akande",
    "Ado Ekiti",
    ["education", "diaspora-and-japa", "careers-and-jobs"],
    "IELTS tutor. 7.5 band is possible.",
    6,
    "gmail.com",
  ),
  P(
    "Nkechi",
    "Ibe",
    "Aba",
    ["fashion-and-owambe", "food-and-chop", "business-and-money"],
    "Aba made. Shoes, bags and ogbono soup.",
    0,
    "yahoo.com",
  ),
  P(
    "Rotimi",
    "Ajayi",
    "Akure",
    ["tech-and-startups", "gaming", "science-and-innovation"],
    "Indie game developer. Lagos, Akure, remote.",
    18,
    "gmail.com",
  ),
];

type Line = [who: "me" | "them", text: string];

/** Real sounding chats, in plain English and Pidgin. The key is the person's first name. */
const CHATS: Record<string, Line[]> = {
  Adaeze: [
    ["them", "How far? You see the match yesterday?"],
    ["me", "Of course. Arsenal were cooking in that second half."],
    ["them", "Told you. Saka is on another level."],
    ["me", "Chelsea fans must be quiet today"],
    ["them", "Make we gist about am inside room tonight. 8pm?"],
    ["me", "Oya. I go start one."],
    ["them", "No wahala. I dey come."],
  ],
  Tunde: [
    ["them", "Bro, are you free this weekend? Need your eyes on the new onboarding flow."],
    ["me", "Saturday afternoon works. Send the link."],
    ["them", "Sending now. Be harsh, please."],
    ["me", "Always. The signup step is the weak point, I think."],
    ["them", "Yes! Users drop at the password page. Working on it."],
    ["me", "Add a progress hint. People hate not knowing how long it takes."],
    ["them", "Good one. Thanks man."],
  ],
  Chidi: [
    ["them", "You saw what they said about the fuel price?"],
    ["me", "Yes. It is getting rough for everyone."],
    ["them", "My transport to work alone has doubled. Wetin we go do?"],
    ["me", "I started carpooling with two colleagues. It helps small."],
    ["them", "Smart. I will try that from Monday."],
  ],
  Zainab: [
    ["them", "Good morning! My brother's wedding is next month and I need ankara ideas."],
    ["me", "Congratulations to him! What colours are they using?"],
    ["them", "Green and gold. Owambe style."],
    ["me", "Green and gold will look great on you."],
    ["them", "Thank you. I will send you the sketch tonight."],
  ],
  Bayo: [
    ["them", "Have you heard the new fuji and amapiano mix? It is wild."],
    ["me", "Send it. I need new music for the long drive."],
    ["them", "Link is on the way. Ready for Friday?"],
    ["me", "I am ready. Which owambe are we hitting?"],
    ["them", "Ikeja, 7pm. Do not be late o."],
  ],
  Ngozi: [
    ["them", "I have a webinar on the IELTS and UK visas this Saturday. Interested?"],
    ["me", "Yes please. I want to hear what changed this year."],
    ["them", "A lot actually. I will add you to the list."],
    ["me", "Thank you for always looking out."],
    ["them", "That is what friends are for."],
  ],
  Ibrahim: [
    ["them", "Salaam. The harvest this season was better than we expected."],
    ["me", "Alhamdulillah. How much did you get from the rice farm?"],
    ["them", "Almost double last year. The rain came at the right time."],
    ["me", "That is a blessing. Congratulations!"],
  ],
  Funmi: [
    ["them", "Please pray for my daughter. She starts primary school on Monday."],
    ["me", "She will do great. Which school?"],
    ["them", "The one near our house in Abeokuta. I am more nervous than her."],
    ["me", "That is every parent on resumption day. Send me a picture!"],
  ],
};

/** Seed call records with all timestamps at or after the current seed time. */
const CALLS: {
  name: string;
  media: "AUDIO" | "VIDEO";
  outcome: "ANSWERED" | "MISSED" | "DECLINED";
  min: number;
  mine: boolean;
}[] = [
  {
    name: "Adaeze",
    media: "AUDIO",
    outcome: "ANSWERED",
    min: 32,
    mine: true,
  },
  {
    name: "Tunde",
    media: "VIDEO",
    outcome: "ANSWERED",
    min: 18,
    mine: false,
  },
  { name: "Chidi", media: "AUDIO", outcome: "MISSED", min: 0, mine: false },
  { name: "Ngozi", media: "VIDEO", outcome: "ANSWERED", min: 47, mine: true },
  { name: "Bayo", media: "AUDIO", outcome: "DECLINED", min: 0, mine: true },
];

const SCHEDULED: {
  title: string;
  topic: string;
  hostFirst: string;
  media: "AUDIO" | "VIDEO";
  language: "ENGLISH" | "PIDGIN" | "YORUBA" | "IGBO" | "HAUSA";
  description: string;
}[] = [
  {
    title: "Arsenal vs Chelsea: who go win?",
    topic: "football",
    hostFirst: "Adaeze",
    media: "AUDIO",
    language: "PIDGIN",
    description: "Match preview, predictions and banter. Bring your scoreline.",
  },
  {
    title: "Japa diaries: UK or Canada?",
    topic: "diaspora-and-japa",
    hostFirst: "Kemi",
    media: "VIDEO",
    language: "ENGLISH",
    description: "Someone who did it answers your visa, work and settling in questions.",
  },
  {
    title: "Jollof wars: Lagos, Port Harcourt or Ghana?",
    topic: "food-and-chop",
    hostFirst: "Blessing",
    media: "AUDIO",
    language: "PIDGIN",
    description: "The only debate that matters. Recipes allowed.",
  },
  {
    title: "Amapiano vs Afrobeats: what is on repeat",
    topic: "music-and-gbedu",
    hostFirst: "Segun",
    media: "AUDIO",
    language: "ENGLISH",
    description: "DJ Segun plays and argues. Request a song.",
  },
  {
    title: "Fuel price and your pocket",
    topic: "politics-and-governance",
    hostFirst: "Chidi",
    media: "AUDIO",
    language: "ENGLISH",
    description: "How people are coping, and what can change.",
  },
  {
    title: "NYSC camp stories and what they never told you",
    topic: "campus-life",
    hostFirst: "Dayo",
    media: "AUDIO",
    language: "PIDGIN",
    description: "Orientation camp, posting day and primary assignment gist.",
  },
  {
    title: "Side hustles that actually pay in 2026",
    topic: "business-and-money",
    hostFirst: "Emeka",
    media: "AUDIO",
    language: "ENGLISH",
    description: "Real numbers from real hustles. No get rich quick.",
  },
  {
    title: "Situationship edition: when is it love?",
    topic: "relationships",
    hostFirst: "Funmi",
    media: "AUDIO",
    language: "PIDGIN",
    description: "A marriage counsellor and friends talk honestly.",
  },
  {
    title: "Best Nollywood movie of the year so far",
    topic: "nollywood-and-movies",
    hostFirst: "Bayo",
    media: "VIDEO",
    language: "ENGLISH",
    description: "Vote, defend your pick, find something to watch tonight.",
  },
  {
    title: "WAEC and JAMB: tips from people who passed",
    topic: "education",
    hostFirst: "Tolani",
    media: "AUDIO",
    language: "ENGLISH",
    description: "Study plans, timetables and mistakes to avoid.",
  },
  {
    title: "Building in Yaba: startup lessons",
    topic: "tech-and-startups",
    hostFirst: "Tunde",
    media: "VIDEO",
    language: "ENGLISH",
    description: "Hiring, fundraising and shipping in Lagos.",
  },
  {
    title: "Sunday reflections",
    topic: "religion-and-spirituality",
    hostFirst: "Ibrahim",
    media: "AUDIO",
    language: "HAUSA",
    description: "A calm conversation about faith and daily life.",
  },
  {
    title: "Match day predictions",
    topic: "football",
    hostFirst: "Adaeze",
    media: "AUDIO",
    language: "PIDGIN",
    description: "Bring your scoreline and make your case before kickoff.",
  },
  {
    title: "Owambe plans for the weekend",
    topic: "fashion-and-owambe",
    hostFirst: "Zainab",
    media: "VIDEO",
    language: "ENGLISH",
    description: "Outfit ideas, colour combinations and event plans.",
  },
  {
    title: "Your first tech job: ask anything",
    topic: "careers-and-jobs",
    hostFirst: "Ngozi",
    media: "AUDIO",
    language: "ENGLISH",
    description: "Bring your CV questions and hear practical advice.",
  },
  {
    title: "Gbedu hour: new sounds",
    topic: "music-and-gbedu",
    hostFirst: "Bayo",
    media: "AUDIO",
    language: "ENGLISH",
    description: "Share what is on repeat and find your next favourite track.",
  },
];

const userEmail = (p: Person) => `${p.first}.${p.last}.gistroom@${p.domain}`.toLowerCase();
const userName = (p: Person) => `${p.last}_${p.first}`.toLowerCase().slice(0, 20);
const orderedPair = (a: string, b: string) => (a < b ? { low: a, high: b } : { low: b, high: a });
export interface FriendsSummary {
  people: number;
  friendships: number;
  requests: number;
  messages: number;
  calls: number;
  scheduledRooms: number;
  notifications: number;
}

export async function seedFriendsWorld(
  db: PrismaClient,
  input: { primaryEmail: string; secondEmail?: string },
  now = new Date(),
): Promise<FriendsSummary> {
  const felix = await db.user.findUnique({ where: { email: input.primaryEmail } });
  if (!felix) throw new Error(`No account with the email ${input.primaryEmail}. Sign up first.`);
  const second = input.secondEmail
    ? await db.user.findUnique({ where: { email: input.secondEmail } })
    : null;

  const firstRoomAt = new Date(now.getTime() + 20 * 3_600_000);
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
  const scheduledRoomAt = (index: number) =>
    new Date(
      firstRoomAt.getTime() +
        ((endOfNextMonth.getTime() - firstRoomAt.getTime()) * index) / (SCHEDULED.length - 1),
    );

  // People
  const ids = new Map<string, string>();
  for (const p of PEOPLE) {
    const row = await db.user.upsert({
      where: { email: userEmail(p) },
      create: {
        email: userEmail(p),
        emailVerifiedAt: now,
        passwordHash: null,
        name: `${p.first} ${p.last}`,
        username: userName(p),
        bio: `${p.bio} (${p.city})`,
        onboardedAt: now,
        ageConfirmedAt: now,
        termsAcceptedAt: now,
        lastSeenAt: now,
        isSeed: true,
        timezone: "Africa/Lagos",
      },
      update: {
        bio: `${p.bio} (${p.city})`,
        lastSeenAt: now,
        isSeed: true,
      },
    });
    ids.set(p.first, row.id);
    await db.userInterest.createMany({
      data: p.interests.map((topicSlug) => ({ userId: row.id, topicSlug })),
      skipDuplicates: true,
    });
  }
  const id = (first: string) => ids.get(first) ?? "";

  // Friendships
  const nextYear = new Date(now.getTime() + 365 * 86_400_000);
  let friendships = 0;
  const befriend = async (a: string, b: string, since: Date) => {
    const { low, high } = orderedPair(a, b);
    const had = await db.friendship.findUnique({
      where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
    });
    if (had) {
      await db.friendship.update({
        where: { id: had.id },
        data: { createdAt: since, nextAnniversaryAt: nextYear },
      });
      return;
    }
    await db.friendship.create({
      data: { userLowId: low, userHighId: high, nextAnniversaryAt: nextYear, createdAt: since },
    });
    friendships += 1;
  };
  for (const p of PEOPLE) {
    if (p.with === "felix" || p.with === "both") await befriend(felix.id, id(p.first), now);
    if ((p.with === "second" || p.with === "both") && second)
      await befriend(second.id, id(p.first), now);
  }
  // The seeded people know each other too, so mutual friends show up.
  const web: [string, string][] = [
    ["Adaeze", "Tunde"],
    ["Adaeze", "Femi"],
    ["Adaeze", "Chidi"],
    ["Tunde", "Obinna"],
    ["Tunde", "Emeka"],
    ["Ngozi", "Kemi"],
    ["Ngozi", "Tolani"],
    ["Zainab", "Yetunde"],
    ["Zainab", "Nkechi"],
    ["Bayo", "Segun"],
    ["Funmi", "Folake"],
    ["Seun", "Dayo"],
    ["Chidi", "Kelechi"],
    ["Emeka", "Chinedu"],
    ["Ibrahim", "Usman"],
  ];
  for (const [a, b] of web) await befriend(id(a), id(b), now);

  // Requests: three waiting for the prime user, one they sent that is waiting, one rejected, one blocked
  let requests = 0;
  const request = async (from: string, to: string, status: "PENDING" | "REJECTED" = "PENDING") => {
    const had = await db.friendRequest.findFirst({
      where: { requesterId: from, addresseeId: to },
    });
    if (had) {
      await db.friendRequest.update({
        where: { id: had.id },
        data: {
          status,
          createdAt: now,
          respondedAt: status === "REJECTED" ? now : null,
          retryAfter: status === "REJECTED" ? new Date(now.getTime() + 6 * 86_400_000) : null,
        },
      });
      return;
    }
    await db.friendRequest.create({
      data: {
        requesterId: from,
        addresseeId: to,
        status,
        ...(status === "REJECTED"
          ? { respondedAt: now, retryAfter: new Date(now.getTime() + 6 * 86_400_000) }
          : {}),
        createdAt: now,
      },
    });
    requests += 1;
  };
  await request(id("Blessing"), felix.id);
  await request(id("Yetunde"), felix.id);
  await request(id("Amina"), felix.id);
  await request(felix.id, id("Chinedu"));
  await request(id("Nkechi"), felix.id, "REJECTED");
  if (second) {
    await request(id("Kelechi"), second.id);
    await request(id("Usman"), second.id);
  }
  const blocked = id("Rotimi");
  if (blocked) {
    await db.block.upsert({
      where: { blockerId_blockedId: { blockerId: felix.id, blockedId: blocked } },
      create: { blockerId: felix.id, blockedId: blocked },
      update: {},
    });
  }

  // Chats with history, in real language, plus the odd edit, reaction, star and deleted line
  let messages = 0;
  for (const [first, lines] of Object.entries(CHATS)) {
    const them = id(first);
    const { low, high } = orderedPair(felix.id, them);
    const dmKey = `${low}:${high}`;
    let convo = await db.conversation.findUnique({ where: { dmKey } });
    if (!convo) {
      convo = await db.conversation.create({
        data: { dmKey, members: { create: [{ userId: felix.id }, { userId: them }] } },
      });
    }
    if ((await db.message.count({ where: { conversationId: convo.id } })) > 0) continue;
    const base = now.getTime() + Object.keys(CHATS).indexOf(first) * 30 * 60_000;
    let lastRow: { id: string; createdAt: Date } | null = null;
    for (const [i, [who, text]] of lines.entries()) {
      const row: { id: string; createdAt: Date } = await db.message.create({
        data: {
          conversationId: convo.id,
          senderId: who === "me" ? felix.id : them,
          clientId: `seed_${first}_${i}_${randomUUID()}`,
          body: text,
          createdAt: new Date(base + i * 11 * 60_000),
          ...(i === 2 && who === "me"
            ? { editedAt: new Date(base + i * 11 * 60_000 + 120_000) }
            : {}),
          ...(i === 3 && who === "them" ? { replyToId: lastRow?.id ?? null } : {}),
        },
      });
      lastRow = row;
      messages += 1;
      if (i === 1) {
        await db.messageReaction.create({
          data: { userId: who === "me" ? them : felix.id, messageId: row.id, emoji: "\u{1F44F}" },
        });
      }
      if (i === 4) await db.messageStar.create({ data: { userId: felix.id, messageId: row.id } });
    }
    await db.conversation.update({
      where: { id: convo.id },
      data: { lastMessageAt: lastRow?.createdAt ?? now },
    });
  }

  // Calls the prime user had, shown in the chats and in the call log
  let calls = 0;
  for (const [callIndex, c] of CALLS.entries()) {
    const them = id(c.name);
    const { low, high } = orderedPair(felix.id, them);
    const convo = await db.conversation.findUnique({ where: { dmKey: `${low}:${high}` } });
    if (!convo) continue;
    const startedAt = new Date(now.getTime() + callIndex * 2 * 3_600_000);
    const caller = c.mine ? felix.id : them;
    const callee = c.mine ? them : felix.id;
    const clientId = `seedcall:${c.name}`;
    const had = await db.message.findUnique({
      where: { senderId_clientId: { senderId: caller, clientId } },
    });
    if (had) continue;
    const call = await db.call.create({
      data: {
        callerId: caller,
        calleeId: callee,
        initialMedia: c.media,
        status:
          c.outcome === "ANSWERED" ? "ENDED" : c.outcome === "DECLINED" ? "DECLINED" : "MISSED",
        livekitRoom: `call_${randomUUID()}`,
        ringExpiresAt: new Date(startedAt.getTime() + 45_000),
        answeredAt: c.outcome === "ANSWERED" ? startedAt : null,
        endedAt: new Date(startedAt.getTime() + Math.max(c.min * 60_000, 45_000)),
        endReason: c.outcome === "ANSWERED" ? "hangup" : "seed",
        createdAt: startedAt,
      },
    });
    await db.message.create({
      data: {
        conversationId: convo.id,
        senderId: caller,
        clientId,
        type: "SYSTEM",
        body: null,
        createdAt: new Date(startedAt.getTime() + Math.max(c.min * 60_000, 45_000)),
        meta: {
          kind: "CALL",
          callId: call.id,
          media: c.media,
          outcome: c.outcome,
          durationSec: c.min * 60,
          startedAt: startedAt.toISOString(),
          callerId: caller,
        },
      },
    });
    const p = PEOPLE.find((x) => x.first === c.name);
    const entry = (userId: string, peerId: string, peerName: string, outgoing: boolean) => ({
      userId,
      kind: "DIRECT" as const,
      direction: outgoing ? ("OUTGOING" as const) : ("INCOMING" as const),
      outcome:
        c.outcome === "MISSED" && !outgoing
          ? ("MISSED" as const)
          : c.outcome === "MISSED"
            ? ("CANCELLED" as const)
            : c.outcome,
      mediaType: c.media,
      peerUserId: peerId,
      titleSnapshot: peerName,
      searchText: peerName.toLowerCase(),
      startedAt,
      durationSec: c.min * 60,
    });
    await db.callLogEntry.createMany({
      data: [entry(felix.id, them, `${p?.first ?? ""} ${p?.last ?? ""}`.trim(), c.mine)],
    });
    calls += 1;
  }

  // Rooms: scheduled public rooms across the topics, a private one he is invited to, and ended ones he was in
  const topics = new Map((await db.topic.findMany()).map((t) => [t.slug, t.id]));
  let scheduledRooms = 0;
  for (const [i, r] of SCHEDULED.entries()) {
    const host = id(r.hostFirst);
    const existing = await db.room.findFirst({
      where: { title: r.title, hostId: host },
      select: { id: true },
    });
    if (existing) {
      await db.room.update({
        where: { id: existing.id },
        data: {
          status: "SCHEDULED",
          scheduledFor: scheduledRoomAt(i),
          startedAt: null,
          endedAt: null,
          createdAt: now,
          peakParticipants: 0,
          messageCount: 0,
          reactionCount: 0,
        },
      });
      scheduledRooms += 1;
      continue;
    }
    await db.room.create({
      data: {
        slug: slugFromBytes(randomBytes(12)),
        hostId: host,
        title: r.title,
        topicId: topics.get(r.topic) ?? null,
        description: r.description,
        language: r.language,
        media: r.media,
        status: "SCHEDULED",
        scheduledFor: scheduledRoomAt(i),
        livekitRoom: `room_${randomUUID()}`,
        members: {
          create: [
            { userId: host, role: "HOST", state: "INVITED" },
            ...(i < 3 ? [{ userId: felix.id, state: "INVITED" as const }] : []),
          ],
        },
      },
    });
    scheduledRooms += 1;
  }
  const privateTitle = "Friends only: weekend plans";
  const existingPrivate = await db.room.findFirst({
    where: { title: privateTitle, hostId: id("Tunde") },
    select: { id: true },
  });
  if (existingPrivate) {
    await db.room.update({
      where: { id: existingPrivate.id },
      data: {
        status: "SCHEDULED",
        scheduledFor: new Date(now.getTime() + 26 * 3_600_000),
        startedAt: null,
        endedAt: null,
        createdAt: now,
      },
    });
    scheduledRooms += 1;
  } else {
    await db.room.create({
      data: {
        slug: slugFromBytes(randomBytes(12)),
        hostId: id("Tunde"),
        title: privateTitle,
        topicId: topics.get("relationships") ?? null,
        description: "A small room for people who know each other.",
        visibility: "PRIVATE",
        status: "SCHEDULED",
        scheduledFor: new Date(now.getTime() + 26 * 3_600_000),
        livekitRoom: `room_${randomUUID()}`,
        members: {
          create: [
            { userId: id("Tunde"), role: "HOST", state: "INVITED" },
            { userId: felix.id, state: "INVITED" },
            { userId: id("Adaeze"), state: "INVITED" },
          ],
        },
      },
    });
    scheduledRooms += 1;
  }
  // Rooms the two real test accounts host, starting soon, with seeded people already on the list.
  // The livekitRoom prefix marks them so the remove command can find them.
  const hosted: {
    host: string;
    title: string;
    topic: string;
    minutes: number;
    guests: string[];
    description?: string;
  }[] = [
    {
      host: felix.id,
      title: "Felix hosts: Sunday football gist",
      topic: "football",
      minutes: 25,
      guests: ["Adaeze", "Segun", "Tunde", "Chidi", "Dayo"],
    },
    {
      host: felix.id,
      title: "Felix hosts: building in public from Lagos",
      topic: "tech-and-startups",
      minutes: 180,
      guests: ["Emeka", "Kemi", "Ngozi"],
    },
    {
      host: felix.id,
      title: "Chelsea Banter",
      topic: "football",
      minutes: 60,
      guests: ["Adaeze", "Tunde", "Chidi", "Femi"],
      description: "Match talk, bold predictions and proper Chelsea banter before kickoff.",
    },
    {
      host: felix.id,
      title: "Anime Lovers Room",
      topic: "entertainment-and-pop-culture",
      minutes: 180,
      guests: ["Seun", "Obinna", "Ifeoma"],
      description: "Explore new worlds, future tech and the anime worth watching next.",
    },
    ...(second
      ? [
          {
            host: second.id,
            title: "Mastermind hosts: creative hustle night",
            topic: "business-and-money",
            minutes: 40,
            guests: ["Blessing", "Amina", "Bayo", "Yetunde"],
          },
          {
            host: second.id,
            title: "FUTA Alumni Connect",
            topic: "campus-life",
            minutes: 24 * 60,
            guests: ["Dayo", "Tolani", "Obinna", "Ifeoma"],
            description: "FUTA graduates reconnect, share opportunities and build what comes next.",
          },
        ]
      : []),
  ];
  for (const h of hosted) {
    const existing = await db.room.findFirst({
      where: { title: h.title, hostId: h.host },
      select: { id: true },
    });
    if (existing) {
      const scheduledFor = new Date(now.getTime() + h.minutes * 60_000);
      await db.roomMessage.deleteMany({ where: { roomId: existing.id } });
      await db.roomModLog.deleteMany({ where: { roomId: existing.id } });
      await db.roomInviteLink.deleteMany({ where: { roomId: existing.id } });
      await db.note.deleteMany({ where: { roomId: existing.id } });
      await db.roomMember.deleteMany({ where: { roomId: existing.id } });
      await db.room.update({
        where: { id: existing.id },
        data: {
          title: h.title,
          topicId: topics.get(h.topic) ?? null,
          description:
            h.description ??
            "A sample room for testing. Say you are coming and wait for the host to start.",
          visibility: "PUBLIC",
          status: "SCHEDULED",
          scheduledFor,
          startedAt: null,
          endedAt: null,
          locked: false,
          peakParticipants: 0,
          messageCount: 0,
          reactionCount: 0,
          emptySince: null,
          longWarnedAt: null,
          livekitRoom: `room_seed_${randomUUID()}`,
          createdAt: now,
        },
      });
      const others = [felix.id, second?.id].filter((x): x is string => Boolean(x) && x !== h.host);
      await db.roomMember.createMany({
        data: [
          { roomId: existing.id, userId: h.host, role: "HOST", state: "INVITED" },
          ...[...h.guests.map(id), ...others].map((userId) => ({
            roomId: existing.id,
            userId,
            state: "INVITED" as const,
          })),
        ],
      });
      scheduledRooms += 1;
      continue;
    }
    const others = [felix.id, second?.id].filter((x): x is string => Boolean(x) && x !== h.host);
    await db.room.create({
      data: {
        slug: slugFromBytes(randomBytes(12)),
        hostId: h.host,
        title: h.title,
        topicId: topics.get(h.topic) ?? null,
        description:
          h.description ??
          "A sample room for testing. Say you are coming and wait for the host to start.",
        language: "ENGLISH",
        media: "AUDIO",
        status: "SCHEDULED",
        scheduledFor: new Date(now.getTime() + h.minutes * 60_000),
        livekitRoom: `room_seed_${randomUUID()}`,
        members: {
          create: [
            { userId: h.host, role: "HOST", state: "INVITED" },
            ...[...h.guests.map(id), ...others].map((userId) => ({
              userId,
              state: "INVITED" as const,
            })),
          ],
        },
      },
    });
    scheduledRooms += 1;
  }
  // Notifications for the prime user, with real request ids so the buttons work
  let notifications = 0;
  const note = async (
    key: string,
    type: string,
    payload: Record<string, unknown>,
    read = false,
  ) => {
    const exists = await db.notification.findUnique({
      where: { userId_dedupeKey: { userId: felix.id, dedupeKey: `seedfw:${key}` } },
    });
    if (exists) return;
    await db.notification.create({
      data: {
        userId: felix.id,
        type,
        dedupeKey: `seedfw:${key}`,
        payload: payload as never,
        readAt: read ? now : null,
        createdAt: new Date(now.getTime() + notifications * 5 * 60_000),
      },
    });
    notifications += 1;
  };
  for (const first of ["Blessing", "Yetunde", "Amina"]) {
    const r = await db.friendRequest.findFirst({
      where: { requesterId: id(first), addresseeId: felix.id, status: "PENDING" },
    });
    const p = PEOPLE.find((x) => x.first === first);
    if (r && p)
      await note(`fr:${first}`, "FRIEND_REQUEST_RECEIVED", {
        requestId: r.id,
        fromName: `${p.first} ${p.last}`,
        fromUsername: userName(p),
      });
  }
  const invited = await db.room.findFirst({ where: { title: SCHEDULED[0]?.title ?? "" } });
  if (invited)
    await note("invite", "ROOM_INVITE", {
      roomId: invited.id,
      roomSlug: invited.slug,
      roomTitle: invited.title,
      fromName: "Adaeze Okonkwo",
    });
  await note("missed", "CALL_MISSED", {
    fromName: "Chidi Eze",
    fromUsername: "eze_chidi",
    noPush: true,
  });
  await note(
    "dm",
    "DM_MESSAGE",
    { fromName: "Tunde Bakare", preview: "Good one. Thanks man.", count: 1 },
    true,
  );

  return {
    people: PEOPLE.length,
    friendships,
    requests,
    messages,
    calls,
    scheduledRooms,
    notifications,
  };
}

/** Removes every seeded person and everything that points at them. Only touches rows marked isSeed. */
export async function removeFriendsWorld(db: PrismaClient): Promise<{ people: number }> {
  const seeded = await db.user.findMany({ where: { isSeed: true }, select: { id: true } });
  const ids = seeded.map((u) => u.id);
  if (ids.length === 0) return { people: 0 };
  const rooms = await db.room.findMany({
    where: { OR: [{ hostId: { in: ids } }, { livekitRoom: { startsWith: "room_seed_" } }] },
    select: { id: true },
  });
  const roomIds = rooms.map((r) => r.id);
  const convs = await db.conversationMember.findMany({
    where: { userId: { in: ids } },
    select: { conversationId: true },
  });
  const convIds = [...new Set(convs.map((c) => c.conversationId))];
  await db.roomMessage.deleteMany({ where: { roomId: { in: roomIds } } });
  await db.roomModLog.deleteMany({ where: { roomId: { in: roomIds } } });
  await db.roomInviteLink.deleteMany({ where: { roomId: { in: roomIds } } });
  await db.roomMember.deleteMany({ where: { roomId: { in: roomIds } } });
  await db.note.deleteMany({ where: { roomId: { in: roomIds } } });
  await db.room.deleteMany({ where: { id: { in: roomIds } } });
  await db.roomMember.deleteMany({ where: { userId: { in: ids } } });
  await db.call.deleteMany({
    where: { OR: [{ callerId: { in: ids } }, { calleeId: { in: ids } }] },
  });
  await db.callLogEntry.deleteMany({
    where: { OR: [{ userId: { in: ids } }, { peerUserId: { in: ids } }] },
  });
  await db.message.updateMany({
    where: { conversationId: { in: convIds } },
    data: { replyToId: null },
  });
  await db.message.deleteMany({ where: { conversationId: { in: convIds } } });
  await db.note.deleteMany({ where: { conversationId: { in: convIds } } });
  await db.conversation.deleteMany({ where: { id: { in: convIds } } });
  await db.friendship.deleteMany({
    where: { OR: [{ userLowId: { in: ids } }, { userHighId: { in: ids } }] },
  });
  await db.friendRequest.deleteMany({
    where: { OR: [{ requesterId: { in: ids } }, { addresseeId: { in: ids } }] },
  });
  await db.block.deleteMany({
    where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] },
  });
  await db.notification.deleteMany({ where: { dedupeKey: { startsWith: "seedfw:" } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  return { people: ids.length };
}
