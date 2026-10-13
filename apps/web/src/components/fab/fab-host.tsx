"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Compass,
  Link2,
  MessageSquarePlus,
  Mic,
  Phone,
  Search,
  UserPlus,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { AddFriendModal } from "@/components/fab/add-friend-modal";
import { CallModal } from "@/components/fab/call-modal";
import { JoinRoomModal } from "@/components/fab/join-room-modal";
import { fab as copy } from "@/content/fab";
import { cn } from "@/lib/cn";
import { useCallWindow } from "@/lib/call-window/store";
import { resolvePlace, useFabStore, type FabAction } from "@/lib/fab";
import { FAB_CONFIG, FAB_ICON } from "@/lib/fab-config";

const ACTION_ICONS: Record<FabAction["icon"], LucideIcon> = {
  chat: MessageSquarePlus,
  search: Search,
  phone: Phone,
  video: Video,
  "user-plus": UserPlus,
  compass: Compass,
  mic: Mic,
  link: Link2,
};

/** Screens that need the whole corner: an open chat, a call, a live room, and Discover itself. */
const HIDDEN_ON = [
  /^\/app\/chats\/[^/]+/,
  /^\/app\/call\//,
  /^\/app\/rooms\/[^/]+/,
  /^\/app\/discover\/?$/,
];

type ModalName = "call-audio" | "call-video" | "add-friend" | "join-room";

/**
 * The one floating button. Each screen says which place it is, and the button shows that place's icon and actions.
 * A screen that says nothing gets the Discover button. It sits above the phone tab bar, clear of the content, and is
 * hidden where it would cover the thing you are doing.
 */
export function FabHost() {
  const pathname = usePathname();
  const router = useRouter();
  const reduced = useReducedMotion();
  const registered = useFabStore((s) => s.place);
  const place = resolvePlace(registered);
  const config = FAB_CONFIG[place];
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<ModalName | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Menus close when the place changes, and on Escape or a tap outside.
  useEffect(() => setOpen(false), [place, pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const windowMode = useCallWindow((w) => w.state.mode);
  // The call window takes this corner while it is showing, so the button steps aside.
  const hidden = HIDDEN_ON.some((re) => re.test(pathname)) || windowMode !== "HIDDEN";
  const placeName = copy.places[place];
  const single = config.actions.length === 0;

  function run(action: FabAction) {
    setOpen(false);
    if (action.kind.type === "href") router.push(action.kind.href);
    else setModal(action.kind.modal);
  }

  return (
    <>
      {hidden ? null : (
        <div
          ref={root}
          data-fab={place}
          className="pointer-events-none fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-30 md:bottom-6 md:right-6"
        >
          <AnimatePresence>
            {open ? (
              <motion.ul
                id="fab-menu"
                initial={reduced ? false : { opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="pointer-events-auto mb-3 flex flex-col items-end gap-2"
              >
                {config.actions.map((a) => {
                  const Icon = ACTION_ICONS[a.icon];
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => run(a)}
                        className="flex items-center gap-3"
                      >
                        <span className="rounded-full bg-surface px-3 py-2 text-sm font-semibold text-text shadow-soft">
                          {a.label}
                        </span>
                        <span className="flex size-12 items-center justify-center rounded-full bg-yellow-400 text-ink-950 shadow-soft">
                          <Icon aria-hidden className="size-5" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </motion.ul>
            ) : null}
          </AnimatePresence>
          <div className="flex justify-end">
            {single ? (
              <Link
                href="/app/discover"
                aria-label={copy.actions.goDiscover}
                className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-green-600 shadow-lift transition-transform active:scale-95"
              >
                <FabGlyph place={place} reduced={Boolean(reduced)} />
              </Link>
            ) : (
              <button
                type="button"
                aria-expanded={open}
                aria-controls="fab-menu"
                aria-label={open ? copy.close : copy.open(placeName)}
                onClick={() => setOpen((v) => !v)}
                className={cn(
                  "pointer-events-auto flex size-14 items-center justify-center rounded-full bg-green-600 shadow-lift transition-transform active:scale-95",
                )}
              >
                {open ? (
                  <X aria-hidden className="size-6 text-white" />
                ) : (
                  <FabGlyph place={place} reduced={Boolean(reduced)} />
                )}
              </button>
            )}
          </div>
        </div>
      )}
      <CallModal
        media="AUDIO"
        open={modal === "call-audio"}
        onOpenChange={(v) => setModal(v ? "call-audio" : null)}
      />
      <CallModal
        media="VIDEO"
        open={modal === "call-video"}
        onOpenChange={(v) => setModal(v ? "call-video" : null)}
      />
      <AddFriendModal
        open={modal === "add-friend"}
        onOpenChange={(v) => setModal(v ? "add-friend" : null)}
      />
      <JoinRoomModal
        open={modal === "join-room"}
        onOpenChange={(v) => setModal(v ? "join-room" : null)}
      />
    </>
  );
}

/** The place's PNG glyph. It turns and fades into the next one when the place changes. */
function FabGlyph({ place, reduced }: { place: keyof typeof FAB_ICON; reduced: boolean }) {
  return (
    <span className="relative flex size-7">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.img
          key={place}
          src={FAB_ICON[place]}
          alt=""
          width={28}
          height={28}
          initial={reduced ? false : { opacity: 0, rotate: -70, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: 70, scale: 0.6 }}
          transition={{ duration: reduced ? 0 : 0.22 }}
          className="absolute inset-0 size-7"
        />
      </AnimatePresence>
    </span>
  );
}
