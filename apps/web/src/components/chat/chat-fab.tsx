"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MessageSquarePlus, Mic, Search, Sparkles, Star, X, type LucideIcon } from "lucide-react";
import { startTour } from "@/components/app/tour";
import { LogoMark } from "@/components/brand/logo-mark";
import { chat } from "@/content/chat";
import { cn } from "@/lib/cn";
import { StarredDialog } from "./chat-dialogs";

interface Action {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
}

/** Screens that need the whole corner: an open chat, a call and a live room. */
const HIDDEN_ON = [/^\/app\/chats\/[^/]+/, /^\/app\/call\//, /^\/app\/rooms\/[^/]+/];

/** The Gistroom button. It floats on every main screen and opens a speed dial of the things you do most. */
export function ChatFab() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [starredOpen, setStarredOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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

  const actions: Action[] = [
    { id: "room", label: chat.fab.hostRoom, icon: Mic, href: "/app/rooms?new=1" },
    { id: "find", label: chat.fab.findFriends, icon: Search, href: "/app/friends?tab=find" },
    { id: "new", label: chat.fab.newChat, icon: MessageSquarePlus, href: "/app/friends" },
    { id: "starred", label: chat.fab.starred, icon: Star, onSelect: () => setStarredOpen(true) },
    { id: "tour", label: chat.fab.tour, icon: Sparkles, onSelect: startTour },
  ];

  if (HIDDEN_ON.some((re) => re.test(pathname))) return null;

  return (
    <div
      ref={root}
      className="pointer-events-none fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-30 md:bottom-6 md:right-6"
    >
      <AnimatePresence>
        {open ? (
          <motion.ul
            id="chat-fab-menu"
            initial={reduced ? false : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-auto mb-3 flex flex-col items-end gap-2"
          >
            {actions.map((a) => {
              const inner = (
                <>
                  <span className="rounded-full bg-surface px-3 py-2 text-sm font-semibold text-text shadow-soft">
                    {a.label}
                  </span>
                  <span className="flex size-12 items-center justify-center rounded-full bg-yellow-400 text-ink-950 shadow-soft">
                    <a.icon aria-hidden className="size-5" />
                  </span>
                </>
              );
              return (
                <li key={a.id}>
                  {a.href ? (
                    <Link
                      href={a.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        a.onSelect?.();
                      }}
                      className="flex items-center gap-3"
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
      <div className="flex justify-end">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="chat-fab-menu"
          aria-label={open ? chat.fab.close : chat.fab.open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "pointer-events-auto flex size-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lift transition-transform",
            open && "rotate-90",
          )}
        >
          {open ? (
            <X aria-hidden className="size-6" />
          ) : (
            <LogoMark size={30} bubble="currentColor" className="text-white" />
          )}
        </button>
      </div>
      <StarredDialog open={starredOpen} onOpenChange={setStarredOpen} />
    </div>
  );
}
