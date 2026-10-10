"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import {
  DoorOpen,
  Ellipsis,
  Radio,
  ShieldCheck,
  Sparkles,
  Info,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import { buttonStyles } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { nav } from "@/content/landing";
import { cn } from "@/lib/cn";
import { useLiveCount } from "@/lib/use-live-count";

const icons: Record<string, LucideIcon> = {
  features: Sparkles,
  rooms: Radio,
  safety: ShieldCheck,
  about: Info,
};

const spring = { type: "spring", stiffness: 380, damping: 32 } as const;

function LivePill({ count }: { count: number }) {
  return (
    <span className="tabular inline-flex min-h-8 items-center gap-2 rounded-full bg-yellow-400 px-3 text-sm font-semibold text-ink-950">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-ink-950 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-ink-950" />
      </span>
      {nav.liveNow(count)}
    </span>
  );
}

/** Desktop capsule that contracts into a mic bubble on scroll down and fans out into icon buttons. */
function DesktopDock() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const liveCount = useLiveCount();
  const [condensed, setCondensed] = useState(false);
  const [fanned, setFanned] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const lastY = useRef(0);
  const fanRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);

  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { stiffness: 220, damping: 28 });
  const ringScale = useTransform(velocity, (v) => 1 + Math.min(Math.abs(v) / 2400, 1) * 0.45);
  const ringScaleOuter = useTransform(velocity, (v) => 1 + Math.min(Math.abs(v) / 2400, 1) * 0.85);

  useMotionValueEvent(scrollY, "change", (y) => {
    const dy = y - lastY.current;
    lastY.current = y;
    if (reduced) return;
    if (y < 80) {
      setCondensed(false);
      setFanned(false);
    } else if (dy > 4) {
      setCondensed(true);
      setFanned(false);
    } else if (dy < -4) {
      setCondensed(false);
      setFanned(false);
    }
  });

  useEffect(() => {
    if (!fanned) return;
    fanRef.current?.querySelector<HTMLElement>("a")?.focus();
  }, [fanned]);

  function closeFan() {
    setFanned(false);
    bubbleRef.current?.focus();
  }

  function onFanKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeFan();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = Array.from(
      fanRef.current?.querySelectorAll<HTMLElement>("a, button") ?? [],
    ).concat(bubbleRef.current ? [bubbleRef.current] : []);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const fanItems = [
    ...nav.items.slice(0, 2).map((i) => ({ ...i, icon: icons[i.id] ?? Sparkles, short: i.label })),
    { id: "cta", label: nav.cta.label, href: nav.cta.href, icon: DoorOpen, short: "Enter" },
    ...nav.items.slice(2).map((i) => ({ ...i, icon: icons[i.id] ?? Sparkles, short: i.label })),
  ];
  const angles = [155, 122, 90, 58, 25];
  const radius = 124;

  return (
    <nav
      aria-label={nav.label}
      className="pointer-events-none fixed inset-x-0 top-4 z-40 hidden justify-center md:flex"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {!condensed ? (
          <motion.div
            key="capsule"
            initial={reduced ? false : { opacity: 0, scale: 0.35 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.35 }}
            transition={spring}
            style={{ transformOrigin: "50% 0%" }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-surface/95 py-2 pl-4 pr-2 shadow-soft backdrop-blur"
          >
            <Link
              href="/"
              aria-label={nav.home}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full"
            >
              <LogoMark size={32} className="text-text" />
            </Link>
            <LayoutGroup id="dock">
              <ul className="flex items-center" onMouseLeave={() => setActive(null)}>
                {nav.items.map((item) => {
                  const current = pathname === item.href;
                  return (
                    <li key={item.id} className="relative">
                      <Link
                        href={item.href}
                        aria-current={current ? "page" : undefined}
                        onMouseEnter={() => setActive(item.id)}
                        onFocus={() => setActive(item.id)}
                        onBlur={() => setActive(null)}
                        className="relative flex min-h-11 items-center px-4 text-[0.9375rem] font-medium text-text"
                      >
                        {active === item.id ? (
                          <motion.span
                            layoutId="dock-blob"
                            transition={spring}
                            className="absolute inset-0 -z-10 rounded-full bg-green-100"
                          />
                        ) : null}
                        <span className={cn(active === item.id && "text-green-700")}>
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </LayoutGroup>
            {liveCount ? <LivePill count={liveCount} /> : null}
            <Link href={nav.cta.href} className={buttonStyles("primary")}>
              {nav.cta.label}
            </Link>
          </motion.div>
        ) : (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={spring}
            style={{ transformOrigin: "50% 0%" }}
            className="pointer-events-none relative"
            onKeyDown={onFanKeyDown}
          >
            {fanned ? (
              <button
                type="button"
                aria-label={nav.closeMenu}
                tabIndex={-1}
                onClick={closeFan}
                className="pointer-events-auto fixed inset-0 -z-10 cursor-default"
              />
            ) : null}
            <div className="relative size-14">
              <motion.span
                aria-hidden
                style={{ scale: ringScaleOuter }}
                className="absolute inset-0 rounded-full border-2 border-green-600/25"
              />
              <motion.span
                aria-hidden
                style={{ scale: ringScale }}
                className="absolute inset-0 rounded-full border-2 border-green-600/50"
              />
              <button
                ref={bubbleRef}
                type="button"
                aria-expanded={fanned}
                aria-label={fanned ? nav.closeMenu : nav.openMenu}
                onClick={() => setFanned((v) => !v)}
                className="pointer-events-auto relative flex size-14 items-center justify-center rounded-full bg-ink-950 shadow-lift"
              >
                <LogoMark size={36} className="text-white" />
              </button>
            </div>
            <div ref={fanRef} className="absolute left-1/2 top-7 size-0">
              <AnimatePresence>
                {fanned
                  ? fanItems.map((item, i) => {
                      const a = ((angles[i] ?? 90) * Math.PI) / 180;
                      const Icon = item.icon;
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
                          animate={{
                            opacity: 1,
                            x: Math.cos(a) * radius,
                            y: Math.sin(a) * radius,
                            scale: 1,
                          }}
                          exit={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
                          transition={{ ...spring, delay: i * 0.03 }}
                          className="pointer-events-auto absolute -left-8 -top-5 flex w-16 flex-col items-center gap-1"
                        >
                          <Link
                            href={item.href}
                            aria-label={item.label}
                            onClick={() => setFanned(false)}
                            className={cn(
                              "flex size-11 items-center justify-center rounded-full shadow-soft",
                              item.id === "cta"
                                ? "bg-green-600 text-white"
                                : "bg-surface text-text",
                            )}
                          >
                            <Icon aria-hidden className="size-5" />
                          </Link>
                          <span
                            aria-hidden
                            className="rounded-full bg-surface px-2 text-xs font-medium text-text"
                          >
                            {item.short}
                          </span>
                        </motion.div>
                      );
                    })
                  : null}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/** Thumb zone dock for phones: four icon items around a center call to action. */
function MobileDock() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [first, second, third, fourth] = nav.items;
  const left = [first, second];
  const right = [third, fourth];

  const item = (i: (typeof nav.items)[number] | undefined) => {
    if (!i) return null;
    const Icon = icons[i.id] ?? Sparkles;
    const current = pathname === i.href;
    return (
      <li key={i.id}>
        <Link
          href={i.href}
          aria-current={current ? "page" : undefined}
          className={cn(
            "flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-xs font-medium",
            current ? "text-green-700" : "text-text-muted",
          )}
        >
          <Icon aria-hidden className="size-5" />
          {i.label}
        </Link>
      </li>
    );
  };

  return (
    <>
      <nav
        aria-label={nav.label}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
          {left.map(item)}
          <li>
            <Link
              href={nav.cta.href}
              aria-label={nav.cta.label}
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lift"
            >
              <DoorOpen aria-hidden className="size-6" />
            </Link>
          </li>
          {right.slice(0, 1).map(item)}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className="flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-xs font-medium text-text-muted"
            >
              <Ellipsis aria-hidden className="size-5" />
              {nav.more}
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title={nav.moreTitle}>
        <ul className="flex flex-col">
          {[
            ...(right[1] ? [{ label: right[1].label, href: right[1].href }] : []),
            ...nav.moreItems,
          ].map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-12 items-center text-lg font-medium text-text"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

export function VoiceDock() {
  return (
    <>
      <DesktopDock />
      <MobileDock />
    </>
  );
}
