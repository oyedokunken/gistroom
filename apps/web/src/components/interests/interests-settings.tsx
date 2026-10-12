"use client";

import { useState } from "react";
import { InterestPicker } from "@/components/interests/interest-picker";
import { settings } from "@/content/app";

/** The same picker as onboarding, with the same three to eight rule, saved in place. */
export function InterestsSettings({ initial }: { initial: string[] }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex flex-col gap-3" onClickCapture={() => setSaved(false)}>
      <InterestPicker
        initial={initial}
        submitLabel={settings.interests.save}
        onSaved={() => setSaved(true)}
      />
      {saved ? (
        <p role="status" className="text-sm font-medium text-green-700">
          {settings.interests.saved}
        </p>
      ) : null}
    </div>
  );
}
