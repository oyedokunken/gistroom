"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, Loader2 } from "lucide-react";
import { chat } from "@/content/chat";
import type { Row } from "@/lib/chat/rows";
import { formatDayLabel } from "@/lib/time";

export interface MessageListProps {
  /** Changing this (the conversation id) resets the scroll position to the newest message. */
  scrollKey: string;
  rows: Row[];
  renderMessage: (row: Extract<Row, { kind: "message" }>) => ReactNode;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  header?: ReactNode;
  footer?: ReactNode;
}

/** Virtualised thread. Sticks to the newest message, keeps your place when older history is loaded above. */
export function MessageList({
  scrollKey,
  rows,
  renderMessage,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  header,
  footer,
}: MessageListProps) {
  const parent = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const prev = useRef({ first: "", last: "", height: 0, key: "" });

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    estimateSize: (i) => (rows[i]?.kind === "day" ? 40 : 56),
    overscan: 10,
    getItemKey: (i) => rows[i]?.key ?? i,
  });

  const onScroll = useCallback(() => {
    const el = parent.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottom.current = distance < 80;
    setShowLatest(distance > 400);
    if (el.scrollTop < 240 && hasOlder && !loadingOlder) {
      prev.current.height = el.scrollHeight;
      onLoadOlder();
    }
  }, [hasOlder, loadingOlder, onLoadOlder]);

  // Newest message in view on open, and whenever something new arrives while you are already at the bottom.
  useLayoutEffect(() => {
    const el = parent.current;
    if (!el || rows.length === 0) return;
    const first = rows[0]?.key ?? "";
    const last = rows[rows.length - 1]?.key ?? "";
    const p = prev.current;
    const switched = p.key !== scrollKey;
    const prepended = !switched && first !== p.first && last === p.last;

    if (switched) {
      virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
      atBottom.current = true;
    } else if (prepended && p.height > 0) {
      el.scrollTop += el.scrollHeight - p.height;
    } else if (last !== p.last && atBottom.current) {
      virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
    }
    prev.current = { first, last, height: el.scrollHeight, key: scrollKey };
  }, [rows, scrollKey, virtualizer]);

  useEffect(() => {
    const el = parent.current;
    if (!el) return;
    // Late image or font loads change heights, so stay pinned if we were pinned.
    const ro = new ResizeObserver(() => {
      if (atBottom.current && rows.length > 0)
        virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows.length, virtualizer]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={parent}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={chat.title}
        className="absolute inset-0 overflow-y-auto overscroll-contain px-3 py-3 md:px-6"
      >
        {header}
        {loadingOlder ? (
          <p
            role="status"
            className="flex items-center justify-center gap-2 py-2 text-sm text-text-muted"
          >
            <Loader2 aria-hidden className="size-4 animate-spin" />
            {chat.loadingOlder}
          </p>
        ) : null}
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            return (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${item.start}px)`,
                }}
              >
                {row.kind === "day" ? (
                  <div className="flex justify-center py-2">
                    <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-text-muted">
                      {formatDayLabel(row.date)}
                    </span>
                  </div>
                ) : (
                  renderMessage(row)
                )}
              </div>
            );
          })}
        </div>
        {footer}
      </div>
      {showLatest ? (
        <button
          type="button"
          onClick={() =>
            virtualizer.scrollToIndex(rows.length - 1, { align: "end", behavior: "smooth" })
          }
          className="absolute bottom-3 right-4 flex size-11 items-center justify-center rounded-full bg-surface text-text shadow-lift"
          aria-label={chat.jumpToLatest}
        >
          <ArrowDown aria-hidden className="size-5" />
        </button>
      ) : null}
    </div>
  );
}
