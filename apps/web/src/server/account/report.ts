import { dataReport } from "@/content/account-report";
import type { buildExport } from "./service";
import { renderPdf, type PdfLine } from "./pdf";

type ExportData = Awaited<ReturnType<typeof buildExport>>;

/** The longest list of messages the report prints. The rest stay in the account and are counted. */
const MESSAGE_LIMIT = 300;

function when(iso: string | null, timeZone: string): string {
  if (!iso) return dataReport.never;
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-NG", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${date}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

function who(p: { name?: string; username?: string } | null): string {
  return p?.name && p.username ? `${p.name} (@${p.username})` : dataReport.deletedUser;
}

/** The person's data as a readable PDF. Same facts as the export, laid out for a human. */
export function buildReportPdf(data: ExportData, timeZone: string): Buffer {
  const lines: PdfLine[] = [];
  const h = (text: string) => lines.push({ text, size: 14, bold: true, gap: 18 });
  const row = (text: string) => lines.push({ text });
  const empty = () => row(dataReport.nothing);

  lines.push({ text: dataReport.title, size: 22, bold: true });
  row(dataReport.madeOn(when(data.exportedAt, timeZone)));
  lines.push({ text: dataReport.note, gap: 6 });

  h(dataReport.profile);
  const p = data.profile;
  row(`${dataReport.name}: ${p.name}`);
  row(`${dataReport.username}: @${p.username}`);
  row(`${dataReport.email}: ${p.email}`);
  row(`${dataReport.bio}: ${p.bio ?? dataReport.none}`);
  row(`${dataReport.joined}: ${when(p.createdAt, timeZone)}`);
  row(`${dataReport.timezone}: ${p.timezone}`);

  h(dataReport.interests);
  if (data.interests.length) row(data.interests.join(", "));
  else empty();

  h(dataReport.friends(data.friends.length));
  if (!data.friends.length) empty();
  for (const f of data.friends) row(`${who(f)}, ${dataReport.since(when(f.since, timeZone))}`);

  h(dataReport.blocked(data.blocked.length));
  if (!data.blocked.length) empty();
  for (const b of data.blocked) row(`${who(b)}, ${dataReport.since(when(b.since, timeZone))}`);

  h(dataReport.calls(data.calls.length));
  if (!data.calls.length) empty();
  for (const c of data.calls) {
    const mins = Math.floor(c.durationSec / 60);
    const secs = String(c.durationSec % 60).padStart(2, "0");
    row(
      `${when(c.startedAt, timeZone)}: ${c.titleSnapshot}, ${c.mediaType.toLowerCase()}, ${c.outcome.toLowerCase()}, ${mins}:${secs}`,
    );
  }

  h(dataReport.hosted(data.roomsYouHosted.length));
  if (!data.roomsYouHosted.length) empty();
  for (const r of data.roomsYouHosted) {
    row(`${r.title}, ${r.status.toLowerCase()}, ${r.visibility.toLowerCase()}`);
  }

  h(dataReport.attended(data.roomsYouAttended.length));
  if (!data.roomsYouAttended.length) empty();
  for (const r of data.roomsYouAttended) {
    row(`${r.title}, ${r.role.toLowerCase()}, ${when(r.joinedAt, timeZone)}`);
  }

  h(dataReport.notes(data.notes.length));
  if (!data.notes.length) empty();
  for (const n of data.notes) {
    row(`${when(n.createdAt, timeZone)}: ${n.body}`);
  }

  h(dataReport.devices(data.devices.length));
  if (!data.devices.length) empty();
  for (const d of data.devices) {
    row(
      `${d.device ?? dataReport.unknownDevice}, ${dataReport.lastSeen(when(d.lastSeenAt, timeZone))}${d.signedOut ? `, ${dataReport.signedOut}` : ""}`,
    );
  }

  h(dataReport.messages(data.messagesYouSent.length));
  if (!data.messagesYouSent.length) empty();
  const shown = data.messagesYouSent.slice(-MESSAGE_LIMIT);
  if (shown.length < data.messagesYouSent.length) {
    row(dataReport.messagesCut(shown.length, data.messagesYouSent.length));
  }
  for (const m of shown) {
    row(`${when(m.sentAt, timeZone)}: ${m.type === "TEXT" ? m.body : `[${m.type.toLowerCase()}]`}`);
  }

  return renderPdf(dataReport.title, lines);
}
