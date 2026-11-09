"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { roomCards as copy } from "@/content/room-cards";
import { useMediaQuery } from "@/lib/use-media-query";
import { RoomDetail, type DetailRoom } from "./room-detail";

interface Selection {
  selected: string | null;
  select: (slug: string | null) => void;
}

const SelectionContext = createContext<Selection | null>(null);

/** Null outside a RoomsLayout, so a card used on its own simply opens the room page. */
export function useRoomSelection(): Selection | null {
  return useContext(SelectionContext);
}

/**
 * A list of rooms with a details panel next to it. On a wide screen the panel sits beside the list and stays in view.
 * On a phone the chosen room opens in a sheet with a clear way back. The list is never forced into one centered block.
 */
export function RoomsLayout({
  rooms,
  children,
}: {
  rooms: readonly DetailRoom[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const wide = useMediaQuery("(min-width: 1024px)");
  const select = useCallback((slug: string | null) => setSelected(slug), []);
  const value = useMemo(() => ({ selected, select }), [selected, select]);
  // A room that left the list (it ended, or a filter hid it) closes its panel.
  const room = rooms.find((r) => r.slug === selected) ?? null;

  return (
    <SelectionContext.Provider value={value}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-8">
        <div className="min-w-0">{children}</div>
        {wide ? (
          <aside
            aria-label={copy.detail.heading}
            className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-5 lg:block"
          >
            {room ? (
              <>
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    aria-label={copy.detail.close}
                    onClick={() => select(null)}
                    className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
                  >
                    <X aria-hidden className="size-5" />
                  </button>
                </div>
                <RoomDetail room={room} />
              </>
            ) : (
              <p className="py-8 text-center text-text-muted">{copy.detail.none}</p>
            )}
          </aside>
        ) : (
          <Sheet
            open={room !== null}
            onOpenChange={(open) => {
              if (!open) select(null);
            }}
            title={copy.detail.heading}
          >
            {room ? (
              <div className="flex flex-col gap-4 pb-2">
                <Button variant="secondary" onClick={() => select(null)} className="self-start">
                  {copy.detail.back}
                </Button>
                <RoomDetail room={room} onNavigate={() => select(null)} />
              </div>
            ) : null}
          </Sheet>
        )}
      </div>
    </SelectionContext.Provider>
  );
}
