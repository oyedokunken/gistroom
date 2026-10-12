import type { Metadata } from "next";
import { OfflineRetry } from "@/components/app/offline-retry";
import { EmptyState } from "@/components/ui/empty-state";
import { offline } from "@/content/app";

export const metadata: Metadata = { title: offline.title, robots: { index: false, follow: false } };

/** Shown by the service worker when a page cannot load and nothing is cached (Section 11). */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <EmptyState icon="offline" title={offline.heading} body={offline.body} />
      <OfflineRetry />
    </main>
  );
}
