import type {
  CreateRoomInput,
  RoomChatDto,
  RoomDto,
  RoomJoin,
  RoomLinkDto,
  RoomMemberDto,
  RoomModLogDto,
  RoomSettingsInput,
  RoomSummaryDto,
} from "@gistroom/shared";
import { apiFetch } from "@/lib/api";

export type RoomView =
  | { state: "OK"; room: RoomDto }
  | { state: "NOT_INVITED" }
  | { state: "LINK_INVALID" }
  | { state: "ENDED" }
  | { state: "MISSING" };

export interface InviteResultRow {
  userId: string;
  ok: boolean;
  reason?: string;
}

const base = (slug: string) => `/api/rooms/${encodeURIComponent(slug)}`;

export const roomApi = {
  create: (input: CreateRoomInput) => apiFetch<{ room: RoomDto }>("/api/rooms", { body: input }),
  mine: () => apiFetch<{ rooms: RoomDto[] }>("/api/rooms"),
  view: (slug: string, invite?: string | null) =>
    apiFetch<RoomView>(`${base(slug)}${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`),
  join: (slug: string, invite?: string | null) =>
    apiFetch<RoomJoin>(`${base(slug)}/join`, { body: { invite: invite ?? null } }),
  session: (
    slug: string,
    action: "leave" | "start" | "end" | "mute-all" | "lock" | "unlock" | "going" | "not-going",
    extra: { lockUnmute?: boolean } = {},
  ) =>
    apiFetch<{ ok?: boolean; room?: RoomDto }>(`${base(slug)}/session`, {
      body: { action, ...extra },
    }),
  settings: (slug: string, input: RoomSettingsInput) =>
    apiFetch<{ room: RoomDto }>(`${base(slug)}/settings`, { method: "PATCH", body: input }),
  react: (slug: string, emoji: string, messageId?: string) =>
    apiFetch<{ ok: true }>(`${base(slug)}/reactions`, { body: { emoji, messageId } }),
  summary: (slug: string) => apiFetch<{ summary: RoomSummaryDto }>(`${base(slug)}/summary`),
  past: () => apiFetch<{ rooms: RoomSummaryDto[] }>("/api/rooms/past"),
  moderate: (
    slug: string,
    action: "MUTE" | "MUTE_VIDEO" | "REMOVE" | "BAN" | "PROMOTE" | "DEMOTE" | "TRANSFER",
    userId: string,
  ) => apiFetch<{ ok: true }>(`${base(slug)}/moderate`, { body: { action, userId } }),
  members: (slug: string) => apiFetch<{ members: RoomMemberDto[] }>(`${base(slug)}/people`),
  log: (slug: string) => apiFetch<{ log: RoomModLogDto[] }>(`${base(slug)}/people?log=1`),
  chat: (slug: string, cursor?: string | null) =>
    apiFetch<{ items: RoomChatDto[]; nextCursor: string | null }>(
      `${base(slug)}/chat${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  say: (slug: string, clientId: string, body: string) =>
    apiFetch<{ message: RoomChatDto }>(`${base(slug)}/chat`, { body: { clientId, body } }),
  deleteMessage: (slug: string, id: string) =>
    apiFetch<{ ok: true }>(`${base(slug)}/chat?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      body: {},
    }),
  links: (slug: string) =>
    apiFetch<{ links: RoomLinkDto[]; roomUrl: string | null }>(`${base(slug)}/invites`),
  inviteFriends: (slug: string, userIds: string[]) =>
    apiFetch<{ results: InviteResultRow[] }>(`${base(slug)}/invites`, {
      body: { kind: "friends", userIds },
    }),
  inviteFriend: (slug: string, userId: string) =>
    apiFetch<{ ok: true }>(`${base(slug)}/invites`, { body: { kind: "friend", userId } }),
  makeLink: (slug: string, hours: number, maxUses: number | null) =>
    apiFetch<{ link: { id: string; url: string; expiresAt: string } }>(`${base(slug)}/invites`, {
      body: { kind: "link", hours, maxUses },
    }),
  revokeLink: (slug: string, linkId: string) =>
    apiFetch<{ ok: true }>(`${base(slug)}/invites?linkId=${encodeURIComponent(linkId)}`, {
      method: "DELETE",
      body: {},
    }),
  forward: (slug: string, conversationIds: string[]) =>
    apiFetch<{ sent: number }>(`${base(slug)}/invites`, {
      body: { kind: "forward", conversationIds },
    }),
};
