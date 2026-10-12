import type { PublicRoomCard } from "./dto";
import { z } from "zod";
import { emailSchema, nameSchema, otpCodeSchema, usernameSchema } from "./auth";
import { validation } from "./content/validation";

export const BIO_MAX = 160;

export const updateProfileSchema = z
  .object({
    name: nameSchema,
    bio: z.string().trim().max(BIO_MAX, validation.nameTooLong(BIO_MAX)).nullable(),
    discoverable: z.boolean(),
    showPresence: z.boolean(),
    sendReadReceipts: z.boolean(),
    roomInvitesFrom: z.enum(["FRIENDS", "EVERYONE"]),
    dataSaver: z.boolean(),
    timezone: z.string().trim().min(1).max(64),
    username: usernameSchema,
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** What anyone may see about a person: never an email (Section 20). */
export interface PublicUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
}

/** The signed in person's own record. */
export interface MeUser extends PublicUser {
  email: string;
  role: "USER" | "ADMIN";
  onboarded: boolean;
  hasPassword: boolean;
  discoverable: boolean;
  showPresence: boolean;
  sendReadReceipts: boolean;
  roomInvitesFrom: "FRIENDS" | "EVERYONE";
  dataSaver: boolean;
  timezone: string;
}

export type Relationship = "NONE" | "FRIENDS" | "REQUEST_SENT" | "REQUEST_RECEIVED" | "UNAVAILABLE";

export interface PersonResult extends PublicUser {
  mutualFriends: number;
  relationship: Relationship;
}

export interface SessionInfo {
  id: string;
  deviceLabel: string;
  lastSeenAt: string;
  createdAt: string;
  current: boolean;
}

export const userIdSchema = z.object({ userId: z.string().trim().min(1).max(64) });
export type UserIdInput = z.infer<typeof userIdSchema>;

/** Someone who shares at least one interest with the viewer. */
export interface SuggestedPerson extends PersonResult {
  sharedTopics: string[];
}

/** A room as the Discover page shows it. Private rooms appear only for people who are invited. */
export interface DiscoverRoom extends PublicRoomCard {
  /** True for a private room the viewer is invited to. */
  invitedOnly: boolean;
}

export interface DiscoverTopic {
  slug: string;
  name: string;
  /** Live and upcoming rooms the viewer can see on this topic. */
  rooms: number;
}

export interface DiscoverFeed {
  interests: string[];
  live: DiscoverRoom[];
  soon: DiscoverRoom[];
  forYou: DiscoverRoom[];
  topics: DiscoverTopic[];
  people: SuggestedPerson[];
}

export const DISCOVER_SORTS = ["active", "newest"] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];

export const discoverQuerySchema = z.object({
  topic: z.string().trim().max(60).optional(),
  language: z.string().trim().max(12).optional(),
  q: z.string().trim().max(80).optional(),
  sort: z.enum(DISCOVER_SORTS).default("active"),
});
export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;

export interface SearchResults {
  people: PersonResult[];
  chats: { conversationId: string; peer: PublicUser }[];
  rooms: PublicRoomCard[];
  notes: { id: string; body: string; where: string; href: string }[];
}

/** Changing the email takes the current password (when there is one), then a code sent to the new address. */
export const changeEmailStartSchema = z.object({
  newEmail: emailSchema,
  password: z.string().max(128).optional(),
});
export const changeEmailConfirmSchema = z.object({ newEmail: emailSchema, code: otpCodeSchema });

/** Deleting the account asks for a code sent to the email, and the password when there is one. */
export const deleteAccountConfirmSchema = z.object({
  code: otpCodeSchema,
  password: z.string().max(128).optional(),
});
