"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { session as copy } from "@/content/session";
import { live, useLive } from "@/lib/live/live-session";

interface Option {
  value: string;
  label: string;
}

const supportsSink = () =>
  typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

/**
 * Choose the microphone, the camera and, where the browser allows it, the speaker, and flip your own preview like a
 * mirror. The speaker choice is hidden on iPhone, where the browser has no way to set it.
 */
export function DevicePicker({
  mirror,
  onMirror,
  className,
}: {
  mirror: boolean;
  onMirror: (on: boolean) => void;
  className?: string;
}) {
  const status = useLive((s) => s.status);
  const [open, setOpen] = useState(false);
  const [mics, setMics] = useState<Option[]>([]);
  const [cams, setCams] = useState<Option[]>([]);
  const [speakers, setSpeakers] = useState<Option[]>([]);

  useEffect(() => {
    if (!open || status !== "connected") return;
    let cancelled = false;
    void (async () => {
      const [m, c, s] = await Promise.all([
        live().devices("audioinput"),
        live().devices("videoinput"),
        supportsSink() ? live().devices("audiooutput") : Promise.resolve([]),
      ]);
      if (cancelled) return;
      const opt = (l: { id: string; label: string }[]) =>
        l.map((d) => ({ value: d.id, label: d.label }));
      setMics(opt(m));
      setCams(opt(c));
      setSpeakers(opt(s));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, status]);

  const pick = (kind: MediaDeviceKind) => (id: string) => void live().switchDevice(kind, id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={copy.controls.devices}
          title={copy.controls.devices}
          className={
            className ??
            "flex size-14 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
          }
        >
          <Settings2 aria-hidden className="size-6" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="flex w-72 flex-col gap-3 p-3 text-text">
        {mics.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {copy.controls.microphone}
            <Select
              value={live().activeDevice("audioinput") ?? mics[0]?.value}
              onValueChange={pick("audioinput")}
              options={mics}
            />
          </label>
        ) : null}
        {cams.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {copy.controls.camera}
            <Select
              value={live().activeDevice("videoinput") ?? cams[0]?.value}
              onValueChange={pick("videoinput")}
              options={cams}
            />
          </label>
        ) : null}
        {speakers.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {copy.controls.speaker}
            <Select
              value={live().activeDevice("audiooutput") ?? speakers[0]?.value}
              onValueChange={pick("audiooutput")}
              options={speakers}
            />
          </label>
        ) : null}
        <Switch
          label={copy.controls.mirror}
          help={copy.controls.mirrorHelp}
          checked={mirror}
          onChange={onMirror}
        />
      </PopoverContent>
    </Popover>
  );
}
