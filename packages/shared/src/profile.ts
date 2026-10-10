import { z } from "zod";
import { nameSchema } from "./auth";
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
