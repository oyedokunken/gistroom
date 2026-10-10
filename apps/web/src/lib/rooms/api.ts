import type {
  CreateRoomInput,
  RoomChatDto,
  RoomDto,
  RoomJoin,
  RoomMemberDto,
  RoomModLogDto,
} from "@gistroom/shared";
import { apiFetch } from "@/lib/api";

export type RoomView =
  | { state: "OK"; room: RoomDto }
  | { state: "NOT_INVITED" }
  | { state: "ENDED" }
  | { state: "MISSING" };

export interface InviteLinkRow {
  id: string;
  expiresAt: string;
  maxUses: number | null;
  usedCount: number;
  state: "OK" | "EXPIRED" | "REVOKED" | "USED_UP";
}

const base = (slug: string) => `/api/rooms/${encodeURIComponent(slug)}`;

export const roomApi = {
  create: (input: CreateRoomInput) => apiFetch<{ room: RoomDto }>("/api/rooms", { body: input }),
  mine: () => apiFetch<{ rooms: RoomDto[] }>("/api/rooms"),
  view: (slug: string, invite?: string | null) =>
    apiFetch<RoomView>(`${base(slug)}${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`),
  join: (slug: string, invite?: string | null) =>
    apiFetch<RoomJoin>(`${base(slug)}/join`, { body: { invite: invite ?? null } }),
  session: (slug: string, action: "leave" | "start" | "end" | "mute-all" | "lock" | "unlock") =>
    apiFetch<{ ok?: boolean; room?: RoomDto }>(`${base(slug)}/session`, { body: { action } }),
  moderate: (
    slug: string,
    action: "MUTE" | "REMOVE" | "BAN" | "PROMOTE" | "DEMOTE" | "TRANSFER",
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
  links: (slug: string) => apiFetch<{ links: InviteLinkRow[] }>(`${base(slug)}/invites`),
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
