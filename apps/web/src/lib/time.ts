/** Coarse "5 minutes ago" text. Full dates and times use Intl formatters in the person's locale. */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const sec = Math.round((now.getTime() - date.getTime()) / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} ${min === 1 ? "minute" : "minutes"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} ${hr === 1 ? "hour" : "hours"} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} ${day === 1 ? "day" : "days"} ago`;
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(date);
}

/** Clock time in the viewer's own zone, tabular friendly. Used on message bubbles. */
export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", hour12: true })
    .format(date)
    .replace(/s?([ap]).?m.?/i, (_m, x: string) => ` ${x.toUpperCase()}M`);
}

/** Full date and time for tooltips. */
export function formatFull(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Label for a day separator: Today, Yesterday, or a short date. */
export function formatDayLabel(date: Date, now: Date = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** Call or voice note length, for example 3:07. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${m}:${String(rest).padStart(2, "0")}`;
}

/** A clock time with AM or PM in the viewer's own zone, plus the day when it is not today. For link expiry. */
export function formatExpiry(date: Date, now: Date = new Date()): string {
  const clock = new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/\s?([ap])\.?m\.?/i, (_m, x: string) => ` ${x.toUpperCase()}M`);
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return clock;
  const day = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(date);
  return `${day}, ${clock}`;
}

/** "5 hours" or "12 minutes" until a time. Never negative. */
export function formatUntil(date: Date, now: Date = new Date()): string {
  const min = Math.max(1, Math.round((date.getTime() - now.getTime()) / 60_000));
  if (min < 60) return `${min} ${min === 1 ? "minute" : "minutes"}`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} ${hr === 1 ? "hour" : "hours"}`;
  const day = Math.round(hr / 24);
  return `${day} days`;
}
