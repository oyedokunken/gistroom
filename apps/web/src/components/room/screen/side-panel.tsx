"use client";

import { X } from "lucide-react";
import { type RoomRole, type RoomDto } from "@gistroom/shared";
import { roomCopy as copy } from "@/content/rooms";
import { NotesPanel } from "@/components/notes/notes-panel";
import { ChatPanel } from "../panels/chat-panel";
import { InvitePanel } from "../panels/invite-panel";
import { LogPanel, PeoplePanel } from "../panels/people-panel";
import { SettingsPanel } from "../panels/settings-panel";
import { type PersonState } from "../panels/shared";
import { type Panel } from "./shared";

/** The panel beside the stage: chat, people, notes, invite, settings or the moderator log. */
export function SidePanel({
  panel,
  label,
  room,
  meId,
  role,
  states,
  count,
  onClose,
}: {
  panel: Exclude<Panel, null>;
  label: string | undefined;
  room: RoomDto;
  meId: string;
  role: RoomRole;
  states: Record<string, PersonState>;
  count: number;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label={copy.stage.panels}
      className="absolute inset-y-0 right-0 z-10 flex w-full flex-col bg-surface text-text shadow-lift sm:w-96 md:static md:shadow-none"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-lg font-bold">{label}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.panels.close}
          className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      {panel === "chat" ? <ChatPanel room={room} meId={meId} role={role} /> : null}
      {panel === "people" ? (
        <PeoplePanel room={room} meId={meId} role={role} states={states} count={count} />
      ) : null}
      {panel === "notes" ? <NotesPanel scope={{ roomSlug: room.slug }} /> : null}
      {panel === "invite" ? <InvitePanel room={room} role={role} /> : null}
      {panel === "settings" ? <SettingsPanel room={room} /> : null}
      {panel === "log" ? <LogPanel room={room} /> : null}
    </aside>
  );
}
