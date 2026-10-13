/**
 * A calendar file for one room, so "Add to calendar" works in every calendar app. Plain text with CRLF line ends,
 * text escaped and long lines folded as RFC 5545 asks. Times are UTC, so the person's own app shows them locally.
 */

const stamp = (d: Date): string =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

const escapeText = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 characters continue on the next line after one space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(" " + line.slice(i, i + 74));
  return parts.join("\r\n");
}

export interface IcsInput {
  /** Stable per room, so a changed time updates the same calendar entry. */
  uid: string;
  title: string;
  description?: string;
  startsAt: Date;
  durationMin?: number;
  url: string;
  /** Bumped when the time changes, so calendars replace the old entry. */
  sequence?: number;
  now?: Date;
}

export function buildIcs(input: IcsInput): string {
  const end = new Date(input.startsAt.getTime() + (input.durationMin ?? 60) * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gistroom//Rooms//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@gistroom.ng`,
    `DTSTAMP:${stamp(input.now ?? new Date())}`,
    `DTSTART:${stamp(input.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SEQUENCE:${input.sequence ?? 0}`,
    `SUMMARY:${escapeText(input.title)}`,
    ...(input.description ? [`DESCRIPTION:${escapeText(input.description)}`] : []),
    `URL:${input.url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(input.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
