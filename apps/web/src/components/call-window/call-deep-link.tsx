"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonStyles } from "@/components/ui/button";
import { callWindow as copy } from "@/content/call-window";
import { openCall } from "@/lib/call-window/store";

/**
 * `/app/call/{id}` still works as a link, for push buttons and old bookmarks. It opens the call in the window, which is
 * full screen on a phone, and leaves a quiet page behind it.
 */
export function CallDeepLink({ callId, autoAnswer }: { callId: string; autoAnswer: boolean }) {
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    openCall(callId, { autoAnswer });
  }, [callId, autoAnswer]);
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <EmptyState icon="voice" title={copy.openingCall} body={copy.openingCallBody} />
      <Link href="/app/chats" className={buttonStyles("secondary")}>
        {copy.detailsBack}
      </Link>
    </div>
  );
}
