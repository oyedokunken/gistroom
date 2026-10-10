import { z } from "zod";
import { LANGUAGES, type Language } from "./limits";
import { LIMITS } from "./limits";
import type { PublicUser } from "./profile";

/** Room rules shared by web and the browser (Section 9.6). Pure, so the whole permission matrix is testable. */

export type RoomRole = "HOST" | "MODERATOR" | "MEMBER";
export type RoomMemberState = "INVITED" | "JOINED" | "LEFT" | "REMOVED" | "BANNED";
export type RoomVisibility = "PUBLIC" | "PRIVATE";
export type RoomStatus = "SCHEDULED" | "LIVE" | "ENDED";

export const ROOM_CHAT_MAX = 500;

export const createRoomSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.ROOM_TITLE_MAX),
  topicSlug: z.string().trim().max(60).nullish(),
  language: z.enum(LANGUAGES as unknown as [Language, ...Language[]]).default("ENGLISH"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  description: z.string().trim().max(500).nullish(),
  /** ISO time. Leave out to start the room now. */
  scheduledFor: z.string().datetime().nullish(),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const roomChatSchema = z.object({
  clientId: z.string().trim().min(8).max(64),
  body: z.string().trim().min(1).max(ROOM_CHAT_MAX),
});

export const inviteLinkSchema = z.object({
  hours: z
    .number()
    .int()
    .refine((h) => (LIMITS.INVITE_LINK_TTL_OPTIONS_HOURS as readonly number[]).includes(h))
    .default(LIMITS.INVITE_LINK_DEFAULT_TTL_HOURS),
  maxUses: z.number().int().min(1).max(500).nullish(),
});

export const modActionSchema = z.object({
  action: z.enum(["MUTE", "REMOVE", "BAN", "PROMOTE", "DEMOTE", "TRANSFER"]),
  userId: z.string().trim().min(1).max(64),
});
export type ModActionInput = z.infer<typeof modActionSchema>;

export const roomForwardSchema = z.object({
  /** Conversation ids to send the room link to. */
  conversationIds: z.array(z.string().trim().min(1).max(64)).min(1).max(10),
});

// ---------- Slugs ----------

const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** An unguessable public id from random bytes. Ten characters from 31 symbols is about 49 bits. */
export function slugFromBytes(bytes: Uint8Array, length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) out += SLUG_ALPHABET[(bytes[i] ?? 0) % SLUG_ALPHABET.length];
  return out;
}

// ---------- Joining ----------

export type JoinDenied = "ENDED" | "NOT_STARTED" | "NOT_INVITED" | "BANNED" | "FULL" | "LOCKED";

export interface JoinInput {
  status: RoomStatus;
  visibility: RoomVisibility;
  locked: boolean;
  isHost: boolean;
  member: { state: RoomMemberState; role: RoomRole; graceUntil: Date | null } | null;
  /** Opened with a link that is valid right now. */
  linkValid: boolean;
  joinedCount: number;
  max: number;
  now: Date;
}

export type JoinVerdict = { ok: true; role: RoomRole } | { ok: false; reason: JoinDenied };

/**
 * Who may enter a room. Private rooms are for invited people only, and anyone else is told "not invited"
 * with nothing about the room (D6). A person who dropped can reclaim their seat during the grace period.
 */
export function joinVerdict(i: JoinInput): JoinVerdict {
  if (i.status === "ENDED") return { ok: false, reason: "ENDED" };
  if (i.member?.state === "BANNED") return { ok: false, reason: "BANNED" };
  if (i.status === "SCHEDULED" && !i.isHost) return { ok: false, reason: "NOT_STARTED" };

  const inGrace =
    i.member !== null &&
    (i.member.state === "JOINED" || i.member.state === "LEFT") &&
    i.member.graceUntil !== null &&
    i.member.graceUntil > i.now;
  const alreadyIn = i.member?.state === "JOINED";
  const role: RoomRole = i.isHost ? "HOST" : (i.member?.role ?? "MEMBER");

  if (i.visibility === "PRIVATE" && !i.isHost) {
    const invited =
      i.linkValid || (i.member !== null && ["INVITED", "JOINED", "LEFT"].includes(i.member.state));
    if (!invited) return { ok: false, reason: "NOT_INVITED" };
  }
  if (i.member?.state === "REMOVED" && i.visibility === "PRIVATE" && !i.linkValid && !i.isHost) {
    return { ok: false, reason: "NOT_INVITED" };
  }

  const privileged = i.isHost || role === "MODERATOR";
  if (i.locked && !privileged && !alreadyIn && !inGrace) return { ok: false, reason: "LOCKED" };
  if (i.joinedCount >= i.max && !alreadyIn && !inGrace && !i.isHost) {
    return { ok: false, reason: "FULL" };
  }
  return { ok: true, role };
}

// ---------- Moderation ----------

export type RoomAbility =
  | "MUTE"
  | "MUTE_ALL"
  | "REMOVE"
  | "BAN"
  | "LOCK"
  | "DELETE_MESSAGE"
  | "INVITE"
  | "LINK"
  | "PROMOTE"
  | "DEMOTE"
  | "TRANSFER"
  | "END"
  | "SEE_LOG";

const MODERATOR_ABILITIES: ReadonlySet<RoomAbility> = new Set([
  "MUTE",
  "MUTE_ALL",
  "REMOVE",
  "BAN",
  "LOCK",
  "DELETE_MESSAGE",
  "INVITE",
  "LINK",
  "PROMOTE",
]);

/** What a role may do at all. Moderators can invite other moderators but cannot demote, transfer or end. */
export function canDo(role: RoomRole | null, ability: RoomAbility): boolean {
  if (role === "HOST") return true;
  if (role === "MODERATOR") return MODERATOR_ABILITIES.has(ability);
  return false;
}

/** Nobody acts on the host. Moderators act on members only. The host acts on anyone else. */
export function canActOn(actor: RoomRole, target: RoomRole): boolean {
  if (target === "HOST") return false;
  if (actor === "HOST") return true;
  return actor === "MODERATOR" && target === "MEMBER";
}

/** The new host when the host leaves: longest serving moderator, else the longest present member. */
export function nextHost(
  members: readonly { userId: string; role: RoomRole; joinedAt: Date | null }[],
  leavingId: string,
): string | null {
  const present = members
    .filter((m) => m.userId !== leavingId && m.joinedAt !== null)
    .sort((a, b) => (a.joinedAt?.getTime() ?? 0) - (b.joinedAt?.getTime() ?? 0));
  const mod = present.find((m) => m.role === "MODERATOR");
  return (mod ?? present[0])?.userId ?? null;
}

// ---------- Invite links ----------

export type LinkState = "OK" | "EXPIRED" | "REVOKED" | "USED_UP";

export function linkState(link: {
  expiresAt: Date;
  revokedAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  now: Date;
}): LinkState {
  if (link.revokedAt) return "REVOKED";
  if (link.expiresAt <= link.now) return "EXPIRED";
  if (link.maxUses !== null && link.usedCount >= link.maxUses) return "USED_UP";
  return "OK";
}

export function linkExpiry(hours: number, from: Date): Date {
  return new Date(from.getTime() + hours * 3_600_000);
}

// ---------- Shapes ----------

export interface RoomMemberDto {
  user: PublicUser;
  role: RoomRole;
  state: RoomMemberState;
}

export interface RoomDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  topicSlug: string | null;
  topicName: string | null;
  language: Language;
  visibility: RoomVisibility;
  status: RoomStatus;
  locked: boolean;
  scheduledFor: string | null;
  startedAt: string | null;
  host: PublicUser;
  joined: number;
  max: number;
  /** The viewer's role, or null when they are not in the room list. */
  myRole: RoomRole | null;
}

export interface RoomJoin {
  room: RoomDto;
  token: string;
  url: string;
  role: RoomRole;
}

export interface RoomChatDto {
  id: string;
  clientId: string;
  sender: PublicUser;
  body: string;
  createdAt: string;
}

export interface RoomModLogDto {
  id: string;
  actor: PublicUser;
  target: PublicUser | null;
  action: string;
  createdAt: string;
}
