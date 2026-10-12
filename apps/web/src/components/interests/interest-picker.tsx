"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";
import { MAX_INTERESTS, MIN_INTERESTS, canonicalTopicSlug, topicsByGroup } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { interests as copy } from "@/content/interests";
import { ApiClientError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

const groups = topicsByGroup();

/** Pick between 3 and 8 topics, grouped. Used at the end of onboarding and again in Settings. */
export function InterestPicker({
  initial,
  to,
  submitLabel = copy.save,
  onSaved,
}: {
  initial: string[];
  /** Where to go after saving. Leave out to stay on the page (Settings). */
  to?: string;
  submitLabel?: string;
  onSaved?: (topics: string[]) => void;
}) {
  const router = useRouter();
  const { showError, showInfo } = useFeedback();
  const [picked, setPicked] = useState<string[]>([...new Set(initial.map(canonicalTopicSlug))]);
  const [busy, setBusy] = useState(false);
  const enough = picked.length >= MIN_INTERESTS;

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
    if (!enough) return;
    setBusy(true);
    try {
      await apiFetch("/api/me/interests", { method: "PUT", body: { topics: picked } });
      onSaved?.(picked);
      if (to) {
        router.replace(to);
        router.refresh();
      } else {
        setBusy(false);
      }
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`interest-${g.id}`} className="flex flex-col gap-2">
          <h2 id={`interest-${g.id}`} className="text-sm font-bold text-text-muted">
            {g.label}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {g.topics.map((t) => {
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
        </section>
      ))}
      <div className="sticky bottom-0 -mx-1 flex flex-col gap-3 bg-surface/95 px-1 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="tabular text-sm font-semibold text-text">
          {enough ? copy.countDone(picked.length) : copy.count(picked.length)}
        </p>
        <Button
          onClick={() => void save()}
          loading={busy}
          disabled={!enough}
          className="min-h-12 sm:min-w-48"
        >
          {busy ? copy.saving : submitLabel}
        </Button>
      </div>
    </div>
  );
}
