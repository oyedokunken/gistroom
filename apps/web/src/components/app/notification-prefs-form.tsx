"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  defaultSwitches,
  NOTIFICATION_TYPES,
  type NotificationPrefs,
  type NotificationType,
} from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { notifySettings as copy } from "@/content/app";
import { ApiClientError, apiFetch } from "@/lib/api";

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const channels = ["inApp", "push", "email"] as const;

export function NotificationPrefsForm() {
  const queryClient = useQueryClient();
  const { showError } = useFeedback();
  const q = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => apiFetch<{ prefs: NotificationPrefs }>("/api/notifications/preferences"),
  });
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [errors, setErrors] = useState<{ start?: string; end?: string }>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.data && !prefs) setPrefs(q.data.prefs);
  }, [q.data, prefs]);

  if (q.isPending || !prefs) return <Skeleton className="h-64 w-full" />;

  const change = (next: NotificationPrefs) => {
    setSaved(false);
    setPrefs(next);
  };

  async function save() {
    if (!prefs) return;
    const nextErrors: { start?: string; end?: string } = {};
    if (prefs.quietStart && !TIME.test(prefs.quietStart)) nextErrors.start = copy.timeInvalid;
    if (prefs.quietEnd && !TIME.test(prefs.quietEnd)) nextErrors.end = copy.timeInvalid;
    if (Boolean(prefs.quietStart) !== Boolean(prefs.quietEnd)) {
      if (!prefs.quietStart) nextErrors.start = copy.timeInvalid;
      else nextErrors.end = copy.timeInvalid;
    }
    setErrors(nextErrors);
    if (nextErrors.start || nextErrors.end) return;
    setBusy(true);
    try {
      await apiFetch("/api/notifications/preferences", { method: "PUT", body: prefs });
      void queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <p className="text-text-muted">{copy.intro}</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left">
          <thead>
            <tr className="text-sm text-text-muted">
              <th scope="col" className="py-2 pr-2 font-medium" />
              {channels.map((c) => (
                <th key={c} scope="col" className="px-2 py-2 text-center font-medium">
                  {copy.channels[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {NOTIFICATION_TYPES.map((type: NotificationType) => {
              const sw = prefs.switches[type] ?? defaultSwitches(type);
              return (
                <tr key={type}>
                  <th scope="row" className="py-2 pr-2 text-base font-medium text-text">
                    {copy.types[type] ?? type}
                  </th>
                  {channels.map((c) => (
                    <td key={c} className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={sw[c]}
                        aria-label={`${copy.types[type] ?? type}: ${copy.channels[c]}`}
                        onChange={(e) =>
                          change({
                            ...prefs,
                            switches: {
                              ...prefs.switches,
                              [type]: { ...sw, [c]: e.target.checked },
                            },
                          })
                        }
                        className="size-6 cursor-pointer accent-green-600"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Switch
        label={copy.previews}
        help={copy.previewsHelp}
        checked={prefs.previews}
        onChange={(v) => change({ ...prefs, previews: v })}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-lg font-bold text-text">{copy.quietHeading}</legend>
        <p className="text-sm text-text-muted">{copy.quietHelp}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={copy.quietStart} error={errors.start}>
            {(props) => (
              <Input
                {...props}
                type="time"
                value={prefs.quietStart ?? ""}
                onChange={(e) => change({ ...prefs, quietStart: e.target.value || null })}
              />
            )}
          </Field>
          <Field label={copy.quietEnd} error={errors.end}>
            {(props) => (
              <Input
                {...props}
                type="time"
                value={prefs.quietEnd ?? ""}
                onChange={(e) => change({ ...prefs, quietEnd: e.target.value || null })}
              />
            )}
          </Field>
        </div>
        {prefs.quietStart || prefs.quietEnd ? (
          <Button
            variant="ghost"
            className="w-fit border border-border"
            onClick={() => change({ ...prefs, quietStart: null, quietEnd: null })}
          >
            {copy.quietClear}
          </Button>
        ) : null}
      </fieldset>

      <div className="flex items-center gap-4">
        <Button loading={busy} onClick={() => void save()}>
          {busy ? copy.saving : copy.save}
        </Button>
        {saved ? (
          <p role="status" className="text-sm font-medium text-green-700">
            {copy.saved}
          </p>
        ) : null}
      </div>
    </div>
  );
}
