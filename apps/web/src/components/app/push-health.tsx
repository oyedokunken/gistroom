"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Smartphone } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { alertHealth, notices } from "@/content/app";
import { alertsHelp } from "@/content/alerts-help";
import { ApiClientError, apiFetch } from "@/lib/api";
import {
  currentSubscription,
  isStandalone,
  pushSupport,
  type PushSupport,
} from "@/lib/push-client";
import { formatFull } from "@/lib/time";
import type { PushDeviceDto } from "@/app/api/push/devices/route";

type TestResult = "SENT" | "NO_SUBSCRIPTION" | "GONE" | "REFUSED" | "SERVICE_DOWN";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-semibold text-text">{value}</dd>
    </div>
  );
}

/** Settings, Notifications: is this device set up, did the last alert arrive, which devices get alerts, and why they stop. */
export function PushHealth() {
  const { confirm, showError, showInfo } = useFeedback();
  const queryClient = useQueryClient();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [hasSub, setHasSub] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [testing, setTesting] = useState(false);
  const devices = useQuery({
    queryKey: ["push-devices"],
    queryFn: () => apiFetch<{ devices: PushDeviceDto[] }>("/api/push/devices"),
  });

  const refresh = useCallback(async () => {
    setSupport(pushSupport());
    setInstalled(isStandalone());
    setHasSub(Boolean(await currentSubscription().catch(() => null)));
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const current = devices.data?.devices.find((d) => d.current);

  async function test() {
    setTesting(true);
    try {
      const { result } = await apiFetch<{ result: TestResult }>("/api/push/test", { body: {} });
      const text: Record<TestResult, string> = {
        SENT: notices.push.testSent,
        NO_SUBSCRIPTION: notices.push.testNoSub,
        GONE: notices.push.testGone,
        REFUSED: notices.push.testRefused,
        SERVICE_DOWN: notices.push.testDown,
      };
      if (result === "SENT") showInfo(text[result]);
      else showError(text[result]);
      void queryClient.invalidateQueries({ queryKey: ["push-devices"] });
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : notices.push.testDown);
    } finally {
      setTesting(false);
    }
  }

  async function remove(d: PushDeviceDto) {
    const ok = await confirm({
      title: alertHealth.removeTitle,
      message: alertHealth.removeBody,
      confirmLabel: alertHealth.remove,
      destructive: true,
    });
    if (!ok) return;
    await apiFetch(`/api/push/devices?id=${encodeURIComponent(d.id)}`, {
      method: "DELETE",
      body: {},
    }).catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: ["push-devices"] });
    void refresh();
  }

  const permission =
    support === "granted"
      ? alertHealth.permissionGranted
      : support === "blocked"
        ? alertHealth.permissionDenied
        : support === "default"
          ? alertHealth.permissionDefault
          : alertHealth.permissionUnsupported;

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="ah-this"
        className="flex flex-col gap-2 rounded-card border border-border p-4"
      >
        <h2 id="ah-this" className="flex items-center gap-2 text-lg font-bold text-text">
          <BellRing aria-hidden className="size-5 text-green-600" />
          {alertHealth.heading}
        </h2>
        <dl className="divide-y divide-border">
          <Row label={alertHealth.permission} value={permission} />
          <Row label={alertHealth.subscription} value={hasSub ? alertHealth.yes : alertHealth.no} />
          <Row label={alertHealth.installed} value={installed ? alertHealth.yes : alertHealth.no} />
          <Row
            label={alertHealth.lastSuccess}
            value={
              current?.lastSuccessAt
                ? formatFull(new Date(current.lastSuccessAt))
                : alertHealth.never
            }
          />
        </dl>
        <p className="text-sm text-text-muted">{alertHealth.installedHelp}</p>
        <Button className="w-fit" loading={testing} onClick={() => void test()}>
          {notices.push.test}
        </Button>
      </section>

      <section aria-labelledby="ah-devices" className="flex flex-col gap-2">
        <h2 id="ah-devices" className="text-lg font-bold text-text">
          {alertHealth.devices}
        </h2>
        <p className="text-sm text-text-muted">{alertHealth.devicesHelp}</p>
        {devices.isPending ? (
          <Skeleton className="h-16" />
        ) : devices.isError ? (
          <p className="text-text-muted">{notices.loadError}</p>
        ) : devices.data.devices.length === 0 ? (
          <p className="text-text-muted">{alertHealth.noDevices}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {devices.data.devices.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 rounded-2xl border border-border p-3"
              >
                <Smartphone aria-hidden className="size-5 shrink-0 text-green-600" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-text">
                    {d.label}
                    {d.current ? ` (${alertHealth.thisDevice})` : ""}
                  </span>
                  <span className="text-sm text-text-muted">
                    {d.needsReauth
                      ? alertHealth.needsReauth
                      : d.signedOut
                        ? alertHealth.signedOut
                        : d.unhealthy
                          ? alertHealth.unhealthy
                          : alertHealth.healthy}
                    {d.lastSuccessAt ? `. ${formatFull(new Date(d.lastSuccessAt))}` : ""}
                  </span>
                </span>
                <Button variant="ghost" onClick={() => void remove(d)}>
                  {alertHealth.remove}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ah-help" className="flex flex-col gap-2">
        <h2 id="ah-help" className="text-lg font-bold text-text">
          {alertsHelp.heading}
        </h2>
        <p className="text-text-muted">{alertsHelp.intro}</p>
        <ul className="flex flex-col gap-3">
          {alertsHelp.items.map((i) => (
            <li key={i.question}>
              <p className="font-semibold text-text">{i.question}</p>
              <p className="text-text-muted">{i.answer}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
