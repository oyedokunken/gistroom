"use client";

import { Button } from "@/components/ui/button";
import { offline } from "@/content/app";

/** Loads the page again. Used on the offline page, where a link back to the app would fail the same way. */
export function OfflineRetry() {
  return (
    <Button onClick={() => window.location.reload()} className="min-h-12 px-8">
      {offline.retry}
    </Button>
  );
}
