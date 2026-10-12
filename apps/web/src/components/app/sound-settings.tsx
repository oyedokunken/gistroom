"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Switch } from "@/components/ui/switch";
import { soundSettings as copy } from "@/content/app";
import { loadSoundSettings, saveSoundSettings, sounds } from "@/lib/sound/sounds";
import type { SoundId, SoundSettings } from "@/lib/sound/sound-manager";

const VOLUMES = [
  { value: "0.4", label: copy.volumeLow },
  { value: "0.7", label: copy.volumeMedium },
  { value: "1", label: copy.volumeHigh },
] as const;

const SAMPLES: Record<"calls" | "rooms" | "messages", SoundId> = {
  calls: "callConnected",
  rooms: "roomJoin",
  messages: "message",
};

/** Sounds are kept on this device. Each kind can be switched off, and each has a button to hear it. */
export function SoundSettingsCard() {
  const [settings, setSettings] = useState<SoundSettings>(() => loadSoundSettings());
  const change = (next: SoundSettings) => {
    setSettings(next);
    saveSoundSettings(next);
  };
  const nearest = VOLUMES.reduce((best, v) =>
    Math.abs(Number(v.value) - settings.master) < Math.abs(Number(best.value) - settings.master)
      ? v
      : best,
  );

  return (
    <section
      aria-labelledby="sounds-h"
      className="flex flex-col gap-3 rounded-card border border-border p-4"
    >
      <h3 id="sounds-h" className="text-lg font-bold text-text">
        {copy.heading}
      </h3>
      <p className="text-sm text-text-muted">{copy.help}</p>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-text">{copy.volume}</span>
        <SegmentedTabs
          label={copy.volume}
          value={nearest.value}
          onChange={(v) => change({ ...settings, master: Number(v) })}
          options={VOLUMES.map((v) => ({ value: v.value, label: v.label }))}
        />
      </div>
      <div className="flex flex-col divide-y divide-border">
        {(["calls", "rooms", "messages"] as const).map((kind) => (
          <div key={kind} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <Switch
                label={copy.kinds[kind].label}
                help={copy.kinds[kind].help}
                checked={settings[kind]}
                onChange={(on) => change({ ...settings, [kind]: on })}
              />
            </div>
            <Button
              variant="secondary"
              aria-label={copy.sampleFor(copy.kinds[kind].label)}
              icon={<Play aria-hidden className="size-4" />}
              onClick={() => sounds().play(SAMPLES[kind], { force: true })}
            >
              {copy.sample}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
