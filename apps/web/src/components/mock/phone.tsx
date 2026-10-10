import type { ReactNode } from "react";
import { ChevronLeft, Wifi } from "lucide-react";
import { cn } from "@/lib/cn";

/** Status bar of a Samsung style phone: time on the left, Wi-Fi, signal and battery on the right. */
export function AndroidStatusBar({
  time = "9:41",
  tone = "dark",
}: {
  time?: string;
  /** dark text on a light screen, or light text on a dark screen. */
  tone?: "dark" | "light";
}) {
  const color = tone === "light" ? "text-white" : "text-text";
  return (
    <div
      aria-hidden
      className={cn("relative flex h-8 shrink-0 items-center justify-between px-5 text-xs", color)}
    >
      <span className="tabular font-semibold">{time}</span>
      {/* punch hole camera, centred */}
      <span className="absolute left-1/2 top-2.5 size-3 -translate-x-1/2 rounded-full bg-ink-950 ring-2 ring-ink-700" />
      <span className="flex items-center gap-1.5">
        <Wifi className="size-3.5" />
        <span className="flex items-end gap-px">
          {[1, 2, 3, 4].map((b) => (
            <span
              key={b}
              className={cn("w-[3px] rounded-[1px] bg-current", b === 4 && "opacity-40")}
              style={{ height: `${b * 2 + 2}px` }}
            />
          ))}
        </span>
        <span className="flex items-center">
          <span className="relative h-3 w-5 rounded-[3px] border border-current">
            <span className="absolute inset-[1.5px] right-[5px] rounded-[1px] bg-current" />
          </span>
          <span className="h-1.5 w-[2px] rounded-r-sm bg-current" />
        </span>
      </span>
    </div>
  );
}

/** Samsung three button navigation: Recents on the left, Home in the middle, Back on the right. */
export function SamsungNavBar({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const color = tone === "light" ? "text-white" : "text-text";
  return (
    <div aria-hidden className={cn("flex h-10 shrink-0 items-center justify-around px-6", color)}>
      <span className="flex h-5 w-8 items-center justify-center gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-3.5 w-[2px] rounded-full bg-current" />
        ))}
      </span>
      <span className="flex h-5 w-8 items-center justify-center">
        <span className="h-3.5 w-7 rounded-full border-2 border-current" />
      </span>
      <span className="flex h-5 w-8 items-center justify-center">
        <ChevronLeft className="size-5" strokeWidth={2.5} />
      </span>
    </div>
  );
}

/**
 * A slim Android phone with a punch hole camera, status bar and the three button navigation bar.
 * Every mockup on the public site shares this frame. The screen content is always a labeled sample.
 */
export function PhoneFrame({
  children,
  label,
  className,
  screenClassName,
  tone = "dark",
  time,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
  screenClassName?: string;
  tone?: "dark" | "light";
  time?: string;
}) {
  return (
    <figure className={cn("w-full max-w-[17.5rem]", className)}>
      <div className="relative rounded-[2.4rem] bg-ink-950 p-[7px] shadow-lift ring-1 ring-ink-700">
        {/* side keys */}
        <span
          aria-hidden
          className="absolute -right-[3px] top-24 h-14 w-[3px] rounded-r bg-ink-700"
        />
        <span
          aria-hidden
          className="absolute -right-[3px] top-44 h-8 w-[3px] rounded-r bg-ink-700"
        />
        <div
          className={cn(
            "relative flex aspect-[9/19] flex-col overflow-hidden rounded-[1.95rem]",
            tone === "light" ? "bg-ink-950 text-white" : "bg-surface text-text",
            screenClassName,
          )}
        >
          <AndroidStatusBar tone={tone} time={time} />
          <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
          <SamsungNavBar tone={tone} />
        </div>
      </div>
      {label ? (
        <figcaption className="mt-3 text-center text-sm opacity-70">{label}</figcaption>
      ) : null}
    </figure>
  );
}
