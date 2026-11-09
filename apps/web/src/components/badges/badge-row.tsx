import {
  CalendarCheck,
  Compass,
  Ear,
  Flame,
  HeartHandshake,
  Mic,
  MessagesSquare,
  Radio,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { badgeAccessibleName, badgeByKey, badgeCountLabel, type BadgeChip } from "@gistroom/shared";
import { badgeCopy } from "@/content/badges";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = {
  Mic,
  Radio,
  HeartHandshake,
  CalendarCheck,
  MessagesSquare,
  Ear,
  Users,
  Compass,
  Flame,
  ShieldCheck,
};

export function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? ShieldCheck;
  return <Icon aria-hidden className={className} />;
}

/**
 * Badges next to a name: a small icon and "x2" when earned more than once. The full name and count are in text for
 * screen readers, and in a tooltip with what the badge means. Yellow fill with ink text, never yellow text.
 */
export function BadgeRow({
  badges,
  className,
}: {
  badges?: readonly BadgeChip[] | null;
  className?: string;
}) {
  if (!badges || badges.length === 0) return null;
  return (
    <ul
      aria-label={badgeCopy.listLabel}
      className={cn("inline-flex flex-wrap items-center gap-1", className)}
    >
      {badges.map((b) => {
        const def = badgeByKey(b.badge);
        if (!def) return null;
        const label = badgeCountLabel(b.count);
        return (
          <li key={b.badge}>
            <span
              title={`${def.name}: ${def.summary}`}
              className="inline-flex min-h-5 items-center gap-0.5 rounded-full bg-yellow-100 px-1.5 text-xs font-bold text-ink-950"
            >
              <BadgeIcon name={def.icon} className="size-3" />
              {label ? (
                <span aria-hidden className="tabular">
                  {label}
                </span>
              ) : null}
              <span className="sr-only">{badgeAccessibleName(def.name, b.count)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The full list on a profile: each badge with its icon, count, what it means and how it is earned. */
export function BadgeList({
  badges,
  showPrivateNote = false,
}: {
  badges: readonly BadgeChip[];
  showPrivateNote?: boolean;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {badges.map((b) => {
        const def = badgeByKey(b.badge);
        if (!def) return null;
        return (
          <li
            key={b.badge}
            className="flex items-start gap-3 rounded-card border border-border bg-surface p-4 text-left"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-ink-950">
              <BadgeIcon name={def.icon} className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-text">{def.name}</span>
                {b.count > 1 ? (
                  <span className="tabular rounded-full bg-yellow-100 px-2 text-xs font-bold text-ink-950">
                    <span aria-hidden>{badgeCountLabel(b.count)}</span>
                    <span className="sr-only">{badgeCopy.earned(b.count)}</span>
                  </span>
                ) : null}
              </span>
              <span className="block text-sm text-text-muted">{def.summary}</span>
              <span className="block text-sm text-text-muted">{def.rule}</span>
              {showPrivateNote && !def.public ? (
                <span className="block text-sm font-medium text-text">{badgeCopy.private}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
