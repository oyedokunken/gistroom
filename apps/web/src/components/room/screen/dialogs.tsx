"use client";

import { LogOut, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { roomCopy as copy } from "@/content/rooms";
import { type RoomMemberDto } from "@gistroom/shared";

/** Asks whether to mute everyone, and whether people may unmute themselves afterwards. */
export function MuteAllDialog({
  open,
  onOpenChange,
  lockUnmute,
  onLockUnmute,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockUnmute: boolean;
  onLockUnmute: (value: boolean) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={VolumeX}
      title={copy.stage.muteAllTitle}
      description={copy.stage.muteAllBody}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {copy.mod.done}
          </Button>
          <Button onClick={() => void onSubmit()}>{copy.stage.muteAll}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <Checkbox
          label={copy.stage.muteAllLock}
          checked={lockUnmute}
          onChange={(e) => onLockUnmute(e.target.checked)}
        />
        <p className="pl-8 text-sm text-text-muted">{copy.stage.muteAllLockHelp}</p>
      </div>
    </Modal>
  );
}

/** What a host sees when leaving: just leave, hand the room to a moderator, or end it for everyone. */
export function LeaveDialog({
  open,
  onOpenChange,
  moderators,
  onJustLeave,
  onEnd,
  onHandOver,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moderators: RoomMemberDto[];
  onJustLeave: () => Promise<void>;
  onEnd: () => Promise<void>;
  onHandOver: (userId: string) => Promise<void>;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={LogOut}
      title={copy.stage.leaveHostTitle}
      description={copy.stage.leaveHostBody}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
              void onJustLeave();
            }}
          >
            {copy.stage.leaveJustLeave}
          </Button>
          <Button variant="danger" onClick={() => void onEnd()}>
            {copy.stage.leaveEndInstead}
          </Button>
        </>
      }
    >
      {moderators.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {moderators.map((m) => (
            <li key={m.user.id}>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => void onHandOver(m.user.id)}
              >
                {copy.stage.leaveHandOver}: {m.user.name}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{copy.stage.leaveNoModerators}</p>
      )}
    </Modal>
  );
}
