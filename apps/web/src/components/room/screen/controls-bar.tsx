"use client";

import { Camera, CameraOff, Mic, MicOff, PhoneOff, SmilePlus } from "lucide-react";
import { REACTIONS, type RoomDto } from "@gistroom/shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { roomCopy as copy } from "@/content/rooms";
import { cn } from "@/lib/cn";
import { useRoomLiveKit } from "@/lib/rooms/use-room-livekit";
import { DevicePicker } from "@/components/session/device-picker";
import { type Panel, type StagePanel } from "./shared";

/** The round buttons along the bottom: mic, camera, devices, reactions, the panels and leave. */
export function ControlsBar({
  lk,
  room,
  panels,
  panel,
  setPanel,
  mirror,
  setMirror,
  toggleMic,
  toggleCamera,
  sendReaction,
  leave,
}: {
  lk: ReturnType<typeof useRoomLiveKit>;
  room: RoomDto;
  panels: StagePanel[];
  panel: Panel;
  setPanel: (panel: Panel) => void;
  mirror: boolean;
  setMirror: (mirror: boolean) => void;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  sendReaction: (emoji: string) => Promise<void>;
  leave: () => Promise<void>;
}) {
  return (
    <nav
      aria-label={copy.stage.panels}
      className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <Round
        label={lk.micOn ? copy.stage.mute : copy.stage.unmute}
        pressed={!lk.micOn}
        onClick={() => void toggleMic()}
        disabled={!lk.connected}
      >
        {lk.micOn ? (
          <Mic aria-hidden className="size-6" />
        ) : (
          <MicOff aria-hidden className="size-6" />
        )}
      </Round>
      <Round
        label={lk.camOn ? copy.stage.cameraOff : copy.stage.cameraOn}
        pressed={lk.camOn}
        onClick={() => void toggleCamera()}
        disabled={!lk.connected}
      >
        {lk.camOn ? (
          <Camera aria-hidden className="size-6" />
        ) : (
          <CameraOff aria-hidden className="size-6" />
        )}
      </Round>
      <DevicePicker mirror={mirror} onMirror={setMirror} />
      {room.settings.reactionsOn ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={copy.stage.reactions}
              title={copy.stage.reactions}
              className="flex size-14 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
            >
              <SmilePlus aria-hidden className="size-6" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="p-2">
            <div
              role="group"
              aria-label={copy.stage.reactions}
              className="grid grid-cols-5 gap-1 text-text"
            >
              {REACTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-label={r.label}
                  onClick={() => void sendReaction(r.emoji)}
                  className="flex size-11 items-center justify-center rounded-full text-2xl hover:bg-green-100"
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
      {panels
        .filter((x) => x.show)
        .map((x) => (
          <Round
            key={x.id}
            label={x.label}
            pressed={panel === x.id}
            onClick={() => setPanel(panel === x.id ? null : x.id)}
          >
            <x.icon aria-hidden className="size-6" />
          </Round>
        ))}
      <Round label={copy.stage.leave} tone="danger" onClick={() => void leave()}>
        <PhoneOff aria-hidden className="size-6" />
      </Round>
    </nav>
  );
}

function Round({
  label,
  children,
  onClick,
  pressed,
  disabled,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-14 items-center justify-center rounded-full transition-colors disabled:opacity-50",
        tone === "danger"
          ? "bg-danger-600 text-white"
          : pressed
            ? "bg-yellow-400 text-ink-950"
            : "bg-white/15 text-white hover:bg-white/25",
      )}
    >
      {children}
    </button>
  );
}
