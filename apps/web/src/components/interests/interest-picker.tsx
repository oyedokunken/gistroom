"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";
import { MAX_INTERESTS, TOPICS } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { interests as copy } from "@/content/interests";
import { ApiClientError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

/** Pick topics as chips. Used at the end of onboarding and again whenever someone changes their mind. */
export function InterestPicker({ initial, to }: { initial: string[]; to: string }) {
  const router = useRouter();
  const { showError, showInfo } = useFeedback();
  const [picked, setPicked] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);

  function toggle(slug: string) {
    if (picked.includes(slug)) {
      setPicked(picked.filter((s) => s !== slug));
    } else if (picked.length >= MAX_INTERESTS) {
      showInfo(copy.tooMany);
    } else {
      setPicked([...picked, slug]);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await apiFetch("/api/me/interests", { method: "PUT", body: { topics: picked } });
      router.replace(to);
      router.refresh();
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ul aria-label={copy.groupLabel} className="flex flex-wrap gap-2">
        {TOPICS.map((t) => {
          const on = picked.includes(t.slug);
          return (
            <li key={t.slug}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(t.slug)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[0.9375rem] font-semibold transition-colors",
                  on
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-border bg-surface text-text hover:bg-green-100",
                )}
              >
                {on ? <Check aria-hidden className="size-4" /> : null}
                {t.name}
              </button>
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className="text-sm text-text-muted">
        {copy.count(picked.length)}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void save()} loading={busy} className="min-h-12">
          {busy ? copy.saving : copy.save}
        </Button>
        <Button variant="secondary" className="min-h-12" onClick={() => router.replace(to)}>
          {copy.skip}
        </Button>
      </div>
    </div>
  );
}
