import { z } from "zod";
import { LIMITS } from "@gistroom/shared";
import type { MailAttachment } from "./transport";
import { buildIcs } from "./ics";
import { button, codeBlock, escapeHtml, heading, paragraph, renderLayout } from "./layout";

export interface RenderContext {
  appUrl: string;
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}

export interface Template<S extends z.ZodTypeAny> {
  id: string;
  schema: S;
  /** Sample props for the preview script and the template tests. */
  sample: z.infer<S>;
  /** A value from the sample that must appear in the text version. */
  check: (props: z.infer<S>) => string;
  render: (props: z.infer<S>, ctx: RenderContext) => Rendered;
}

interface NoticeConfig<S extends z.ZodTypeAny> {
  id: string;
  schema: S;
  sample: z.infer<S>;
  subject: (p: z.infer<S>) => string;
  preheader: (p: z.infer<S>) => string;
  heading: (p: z.infer<S>) => string;
  paragraphs: (p: z.infer<S>) => string[];
  code?: (p: z.infer<S>) => string;
  action?: (p: z.infer<S>) => { label: string; path: string };
  check: (p: z.infer<S>) => string;
  /** Closing paragraphs that come after the code and the button. */
  after?: (p: z.infer<S>) => string[];
  /** Adds the one click link to email preferences. Every email that is not a security notice has it. */
  manage?: boolean;
  /** Extra HTML and text lines for lists, for example suggested rooms. Values are escaped by the template. */
  list?: (p: z.infer<S>) => { label: string; path: string; note?: string }[];
  /** Files that travel with the mail, for example a calendar entry. */
  attachments?: (p: z.infer<S>) => MailAttachment[];
}

export const MANAGE_PATH = "/app/settings/notifications";
export const MANAGE_LABEL = "Manage your email preferences";

/**
 * One shape for every email: heading, short paragraphs, an optional big code, an optional button, and a plain
 * text twin (Section 19). Security mail stays in plain language with no slang (Section 18).
 */
function notice<S extends z.ZodTypeAny>(c: NoticeConfig<S>): Template<S> {
  return {
    id: c.id,
    schema: c.schema,
    sample: c.sample,
    check: c.check,
    render: (p, { appUrl }) => {
      const subject = c.subject(p);
      const action = c.action?.(p);
      const code = c.code?.(p);
      const bodyHtml = [
        heading(c.heading(p)),
        ...c.paragraphs(p).map((t) => paragraph(escapeHtml(t))),
        code ? codeBlock(code) : "",
        ...(c.list?.(p) ?? []).map((i) =>
          paragraph(
            `<a href="${escapeHtml(appUrl + i.path)}">${escapeHtml(i.label)}</a>${i.note ? escapeHtml(" " + i.note) : ""}`,
          ),
        ),
        action ? button(`${appUrl}${action.path}`, action.label) : "",
        ...(c.after?.(p) ?? []).map((t) => paragraph(escapeHtml(t))),
        c.manage
          ? paragraph(`<a href="${escapeHtml(appUrl + MANAGE_PATH)}">${MANAGE_LABEL}</a>`)
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      const text = [
        c.heading(p),
        "",
        ...c.paragraphs(p).flatMap((t) => [t, ""]),
        ...(code ? [`Your code: ${code}`, ""] : []),
        ...(c.list?.(p) ?? []).flatMap((i) => [
          `${i.label}${i.note ? " " + i.note : ""}: ${appUrl}${i.path}`,
        ]),
        ...(c.list ? [""] : []),
        ...(action ? [`${action.label}: ${appUrl}${action.path}`, ""] : []),
        ...(c.after?.(p) ?? []).flatMap((t) => [t, ""]),
        ...(c.manage ? [`${MANAGE_LABEL}: ${appUrl}${MANAGE_PATH}`, ""] : []),
      ]
        .join("\n")
        .trim();
      return {
        subject,
        html: renderLayout({ appUrl, title: subject, preheader: c.preheader(p), bodyHtml }),
        text,
        ...(c.attachments ? { attachments: c.attachments(p) } : {}),
      };
    },
  };
}

const minutes = LIMITS.OTP_TTL_MIN;
const otpProps = z.object({ code: z.string().regex(/^\d{6}$/) });
const otpAfter = () => [
  `This code works for ${minutes} minutes. Never share it with anyone, including people who say they work for Gistroom.`,
  "If you did not ask for this code, you can ignore this email.",
];

const nameProps = z.object({ name: z.string().min(1).max(60) });
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** What every room mail says about the room: who is asking, which room, when, who hosts and where it lives. */
const roomDetailProps = z.object({
  to: z.string().min(1).max(60),
  title: z.string().min(1).max(80),
  when: z.string().max(80),
  host: z.string().min(1).max(60),
  topic: z.string().max(80).nullable(),
  path: z.string().startsWith("/app/"),
});

export const templates = {
  "verify-otp": notice({
    id: "verify-otp",
    schema: otpProps,
    sample: { code: "042917" },
    subject: () => "Your Gistroom code",
    preheader: (p) => `Your code is ${p.code}. It works for ${minutes} minutes.`,
    heading: () => "Confirm your email",
    paragraphs: () => [
      "Use this code to confirm your email address and finish creating your Gistroom account.",
    ],
    code: (p) => p.code,
    after: otpAfter,
    check: (p) => p.code,
  }),
  "reset-otp": notice({
    id: "reset-otp",
    schema: otpProps,
    sample: { code: "318406" },
    subject: () => "Your Gistroom code",
    preheader: (p) => `Your reset code is ${p.code}.`,
    heading: () => "Reset your password",
    paragraphs: () => ["Use this code to choose a new Gistroom password."],
    code: (p) => p.code,
    after: otpAfter,
    check: (p) => p.code,
  }),
  "delete-account-otp": notice({
    id: "delete-account-otp",
    schema: otpProps,
    sample: { code: "770215" },
    subject: () => "Your Gistroom code",
    preheader: (p) => `Your code to delete your account is ${p.code}.`,
    heading: () => "Confirm account deletion",
    paragraphs: () => [
      "Use this code to confirm that you want to delete your Gistroom account. This removes your files and cannot be undone.",
    ],
    code: (p) => p.code,
    after: otpAfter,
    check: (p) => p.code,
  }),
  "email-change-otp": notice({
    id: "email-change-otp",
    schema: otpProps,
    sample: { code: "551290" },
    subject: () => "Your Gistroom code",
    preheader: (p) => `Your code to confirm this email is ${p.code}.`,
    heading: () => "Confirm your new email",
    paragraphs: () => [
      "Use this code to confirm that this is your new email address for your Gistroom account.",
    ],
    code: (p) => p.code,
    after: otpAfter,
    check: (p) => p.code,
  }),
  "email-changed": notice({
    id: "email-changed",
    schema: z.object({ newEmail: z.string().email() }),
    sample: { newEmail: "new.address@example.com" },
    subject: () => "Your Gistroom email address was changed",
    preheader: () => "Your account now uses a different email.",
    heading: () => "Your email address changed",
    paragraphs: (p) => [
      `The email address on your Gistroom account was changed to ${p.newEmail}. This message goes to the old address so you know.`,
      "If you did not do this, write to support@gistroom.ng straight away.",
    ],
    check: (p) => p.newEmail,
  }),
  "password-changed": notice({
    id: "password-changed",
    schema: z.object({ when: z.string().min(1).max(60) }),
    sample: { when: "12 October 2026, 09:30" },
    subject: () => "Your Gistroom password was changed",
    preheader: () => "Your password changed and other devices were signed out.",
    heading: () => "Your password changed",
    paragraphs: (p) => [
      `The password on your Gistroom account was changed on ${p.when}. Every other device was signed out.`,
      "If you did not do this, reset your password now and write to support@gistroom.ng.",
    ],
    action: () => ({ label: "Reset your password", path: "/forgot" }),
    check: (p) => p.when,
  }),
  "account-exists": notice({
    id: "account-exists",
    schema: z.object({}).strict(),
    sample: {},
    subject: () => "You already have a Gistroom account",
    preheader: () => "Sign in or reset your password.",
    heading: () => "You already have an account",
    paragraphs: () => [
      "Someone tried to create a Gistroom account with this email address, and it already has one. If that was you, sign in. If you forgot your password, you can reset it.",
    ],
    action: () => ({ label: "Sign in", path: "/login" }),
    after: () => ["If you did not try to sign up, you can ignore this email."],
    check: () => "already",
  }),
  welcome: notice({
    id: "welcome",
    schema: z.object({
      name: z.string().min(1).max(60),
      /** Rooms that match the topics the person picked. Left out when there are none. */
      rooms: z
        .array(z.object({ title: z.string().min(1).max(80), path: z.string().startsWith("/app/") }))
        .max(3)
        .default([]),
    }),
    sample: {
      name: "Tunde Bello",
      rooms: [{ title: "Match day gist", path: "/app/rooms/abc123" }],
    },
    subject: (p) => `Welcome to Gistroom, ${firstName(p.name)}`,
    preheader: () => "You are in. Find your people.",
    heading: (p) => `You are in, ${firstName(p.name)}`,
    paragraphs: (p) => [
      "Your account is ready. Find your friends, start a room or drop into one already going.",
      ...(p.rooms.length > 0 ? ["Rooms that match what you picked:"] : []),
    ],
    list: (p) => p.rooms.map((r) => ({ label: r.title, path: r.path })),
    action: () => ({ label: "Open Gistroom", path: "/app/discover" }),
    after: () => ["Turn on alerts so calls and messages reach you even when the app is closed."],
    manage: true,
    check: (p) => firstName(p.name),
  }),
  "new-device-sign-in": notice({
    id: "new-device-sign-in",
    schema: z.object({ device: z.string().min(1).max(80), when: z.string().min(1).max(60) }),
    sample: { device: "Chrome on Windows", when: "10 October 2026, 21:40" },
    subject: () => "New sign in to your Gistroom account",
    preheader: (p) => `Signed in on ${p.device}.`,
    heading: () => "New sign in",
    paragraphs: (p) => [
      `Your account was signed in on ${p.device} at ${p.when}.`,
      "If this was you, you do not need to do anything. If it was not, sign that device out and change your password.",
    ],
    action: () => ({ label: "See your devices", path: "/app/settings/devices" }),
    check: (p) => p.device,
  }),
  "missed-call": notice({
    id: "missed-call",
    schema: z.object({ name: z.string().min(1).max(60), media: z.enum(["audio", "video"]) }),
    sample: { name: "Ada", media: "audio" },
    subject: (p) => `Missed ${p.media} call from ${p.name}`,
    preheader: (p) => `${p.name} called you on Gistroom.`,
    heading: (p) => `Missed call from ${p.name}`,
    paragraphs: (p) => [`${p.name} tried to reach you with a ${p.media} call.`],
    action: () => ({ label: "Call back", path: "/app/calls" }),
    manage: true,
    check: (p) => p.name,
  }),
  "friend-request": notice({
    id: "friend-request",
    schema: z.object({ name: z.string().min(1).max(60), username: z.string().min(1).max(20) }),
    sample: { name: "Ada Bello", username: "ada" },
    subject: (p) => `${p.name} wants to be your friend on Gistroom`,
    preheader: (p) => `@${p.username} sent you a friend request.`,
    heading: () => "New friend request",
    paragraphs: (p) => [`${p.name} (@${p.username}) sent you a friend request.`],
    action: () => ({ label: "See the request", path: "/app/friends?tab=requests" }),
    manage: true,
    check: (p) => p.username,
  }),
  "room-invite": notice({
    id: "room-invite",
    schema: z.object({
      /** First name of the person who invited. */
      name: z.string().min(1).max(60),
      to: z.string().min(1).max(60),
      title: z.string().min(1).max(80),
      topic: z.string().max(60).nullable().default(null),
      host: z.string().max(60).nullable().default(null),
      /** The start time in the recipient's own zone, 12 hour. Left out for a room that is live now. */
      when: z.string().max(80).nullable().default(null),
      path: z.string().startsWith("/app/"),
    }),
    sample: {
      name: "Ada",
      to: "Tunde Bello",
      title: "Football talk",
      topic: "Football",
      host: "Ada Okafor",
      when: "Today, 7:30 PM",
      path: "/app/rooms/abc123",
    },
    subject: (p) => `${firstName(p.name)} invited you to ${p.title} on Gistroom`,
    preheader: (p) => (p.when ? `${p.title} starts ${p.when}.` : `${p.title} is live now.`),
    heading: (p) => `Hi ${firstName(p.to)}, you are invited`,
    paragraphs: (p) => [
      `${p.name} invited you to join ${p.title}.`,
      ...(p.topic ? [`Topic: ${p.topic}`] : []),
      ...(p.host ? [`Hosted by ${p.host}`] : []),
      p.when ? `Starts: ${p.when}` : "It is live right now.",
    ],
    action: (p) => ({ label: "Join room", path: p.path }),
    manage: true,
    check: (p) => p.title,
  }),
  "room-registration-confirmed": notice({
    id: "room-registration-confirmed",
    schema: roomDetailProps.extend({
      startsAt: z.string().min(10).max(40),
      slug: z.string().min(4).max(64),
    }),
    sample: {
      to: "Tunde Bello",
      title: "Match day gist",
      when: "Sat, 17 Oct, 7:30 PM",
      host: "Ada Okafor",
      topic: "Football",
      path: "/app/rooms/abc123",
      startsAt: "2026-10-17T18:30:00.000Z",
      slug: "abc123",
    },
    subject: (p) => `You're registered for ${p.title}`,
    preheader: (p) => `${p.title} starts ${p.when}.`,
    heading: (p) => `${firstName(p.to)}, you're registered`,
    paragraphs: (p) => [
      `${p.title}, hosted by ${p.host}${p.topic ? `, on ${p.topic}` : ""}, starts ${p.when}.`,
      "We will remind you 15 minutes before and when it goes live.",
    ],
    list: (p) => [{ label: "Add to calendar", path: `/api/rooms/${p.slug}/calendar` }],
    action: (p) => ({ label: "View room", path: p.path }),
    attachments: (p) => [
      {
        filename: "gistroom-room.ics",
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
        content: buildIcs({
          uid: p.slug,
          title: p.title,
          description: `Hosted by ${p.host} on Gistroom.`,
          startsAt: new Date(p.startsAt),
          url: `${process.env.APP_URL ?? "http://localhost:3000"}${p.path}`,
        }),
      },
    ],
    manage: true,
    check: (p) => p.title,
  }),
  "room-starting-soon": notice({
    id: "room-starting-soon",
    schema: roomDetailProps,
    sample: {
      to: "Tunde Bello",
      title: "Match day gist",
      when: "7:30 PM",
      host: "Ada Okafor",
      topic: "Football",
      path: "/app/rooms/abc123",
    },
    subject: (p) => `${p.title} starts in 15 minutes`,
    preheader: (p) => `Starts at ${p.when}, hosted by ${p.host}.`,
    heading: (p) => `${firstName(p.to)}, ${p.title} starts soon`,
    paragraphs: (p) => [
      `Hosted by ${p.host}${p.topic ? `, on ${p.topic}` : ""}. It starts at ${p.when}, in about 15 minutes.`,
    ],
    action: (p) => ({ label: "Join room", path: p.path }),
    manage: true,
    check: (p) => p.title,
  }),
  "room-live-now": notice({
    id: "room-live-now",
    schema: roomDetailProps,
    sample: {
      to: "Tunde Bello",
      title: "Match day gist",
      when: "7:30 PM",
      host: "Ada Okafor",
      topic: "Football",
      path: "/app/rooms/abc123",
    },
    subject: (p) => `${p.title} is live now`,
    preheader: (p) => `${p.host} just started the room.`,
    heading: (p) => `${firstName(p.to)}, ${p.title} is live`,
    paragraphs: (p) => [`${p.host} just started the room. Come in and join the talk.`],
    action: (p) => ({ label: "Join room", path: p.path }),
    manage: true,
    check: (p) => p.title,
  }),
  "room-rescheduled": notice({
    id: "room-rescheduled",
    schema: roomDetailProps.extend({
      startsAt: z.string().min(10).max(40),
      slug: z.string().min(4).max(64),
    }),
    sample: {
      to: "Tunde Bello",
      title: "Match day gist",
      when: "Sun, 18 Oct, 5:00 PM",
      host: "Ada Okafor",
      topic: "Football",
      path: "/app/rooms/abc123",
      startsAt: "2026-10-18T16:00:00.000Z",
      slug: "abc123",
    },
    subject: (p) => `${p.title} has a new time`,
    preheader: (p) => `It now starts ${p.when}.`,
    heading: (p) => `${firstName(p.to)}, ${p.title} moved`,
    paragraphs: (p) => [
      `${p.host} changed the time. The room now starts ${p.when}. Your reminders moved with it.`,
    ],
    list: (p) => [{ label: "Add to calendar", path: `/api/rooms/${p.slug}/calendar` }],
    action: (p) => ({ label: "View room", path: p.path }),
    attachments: (p) => [
      {
        filename: "gistroom-room.ics",
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
        content: buildIcs({
          uid: p.slug,
          title: p.title,
          description: `Hosted by ${p.host} on Gistroom.`,
          startsAt: new Date(p.startsAt),
          sequence: 1,
          url: `${process.env.APP_URL ?? "http://localhost:3000"}${p.path}`,
        }),
      },
    ],
    manage: true,
    check: (p) => p.title,
  }),
  "room-cancelled": notice({
    id: "room-cancelled",
    schema: z.object({
      to: z.string().min(1).max(60),
      title: z.string().min(1).max(80),
      host: z.string().min(1).max(60),
      path: z.string().startsWith("/app/"),
      reason: z.enum(["NO_START", "HOST_CANCELLED"]),
    }),
    sample: {
      to: "Tunde Bello",
      title: "Match day gist",
      host: "Ada Okafor",
      path: "/app/rooms",
      reason: "NO_START",
    },
    subject: (p) =>
      p.reason === "NO_START" ? `${p.title} didn't start` : `${p.title} was cancelled`,
    preheader: () => "We will let you know if it is rescheduled.",
    heading: (p) => `${firstName(p.to)}, ${p.title} didn't start`,
    paragraphs: (p) => [
      p.reason === "NO_START"
        ? `${p.host} did not start the room, so it was cancelled.`
        : `${p.host} cancelled the room.`,
      "We'll let you know if it's rescheduled.",
    ],
    action: (p) => ({ label: "Browse live rooms", path: p.path }),
    manage: true,
    check: (p) => p.title,
  }),
  "room-ended-summary": notice({
    id: "room-ended-summary",
    schema: z.object({
      to: z.string().min(1).max(60),
      title: z.string().min(1).max(80),
      duration: z.string().max(40),
      peak: z.number().int().min(0),
      attendees: z.number().int().min(0),
      messages: z.number().int().min(0),
      path: z.string().startsWith("/app/"),
    }),
    sample: {
      to: "Ada Okafor",
      title: "Football talk",
      duration: "1 h 12 min",
      peak: 14,
      attendees: 21,
      messages: 86,
      path: "/app/rooms/abc123",
    },
    subject: (p) => `Your room ${p.title} has ended`,
    preheader: (p) => `${p.attendees} people came.`,
    heading: (p) => `${firstName(p.to)}, your room has ended`,
    paragraphs: (p) => [
      `${p.title} ran for ${p.duration}.`,
      `${p.attendees} people came and ${p.peak} were there at the busiest moment. There were ${p.messages} chat messages.`,
    ],
    action: (p) => ({ label: "See the summary", path: p.path }),
    manage: true,
    check: (p) => p.title,
  }),
  "activity-digest": notice({
    id: "activity-digest",
    schema: z.object({
      to: z.string().min(1).max(60),
      requests: z
        .array(z.object({ name: z.string().min(1).max(60), username: z.string().min(1).max(20) }))
        .min(1)
        .max(20),
    }),
    sample: {
      to: "Tunde Bello",
      requests: [
        { name: "Ada Bello", username: "ada" },
        { name: "Chidi Eze", username: "chidi" },
      ],
    },
    subject: (p) =>
      p.requests.length === 1
        ? "1 friend request is waiting on Gistroom"
        : `${p.requests.length} friend requests are waiting on Gistroom`,
    preheader: () => "People want to be your friends.",
    heading: (p) => `${firstName(p.to)}, you have friend requests`,
    paragraphs: (p) => p.requests.map((r) => `${r.name} (@${r.username})`),
    action: () => ({ label: "See the requests", path: "/app/friends?tab=requests" }),
    manage: true,
    check: (p) => p.requests[0]?.username ?? "",
  }),
  "data-export-ready": notice({
    id: "data-export-ready",
    schema: z.object({ path: z.string().startsWith("/") }),
    sample: { path: "/app/settings/export" },
    subject: () => "Your Gistroom data export is ready",
    preheader: () => "Download your data.",
    heading: () => "Your export is ready",
    paragraphs: () => [
      "The copy of your data you asked for is ready. The link works for 24 hours.",
    ],
    action: (p) => ({ label: "Download your data", path: p.path }),
    check: () => "export",
  }),
  "account-deleted": notice({
    id: "account-deleted",
    schema: z.object({}).strict(),
    sample: {},
    subject: () => "Your Gistroom account was deleted",
    preheader: () => "Your account and files are removed.",
    heading: () => "Your account is deleted",
    paragraphs: () => [
      "We removed your account details and your files. In other people's chats you now show as Deleted user.",
      "You can sign up again any time with this email address.",
    ],
    check: () => "deleted",
  }),
  "report-received": notice({
    id: "report-received",
    schema: z.object({}).strict(),
    sample: {},
    subject: () => "We got your report",
    preheader: () => "A person on our team will look at it.",
    heading: () => "We got your report",
    paragraphs: () => [
      "Thank you for telling us. A person on our team will review it. We keep the recent messages as evidence.",
      "We will tell you when we have made a decision.",
    ],
    check: () => "report",
  }),
  "report-resolved": notice({
    id: "report-resolved",
    schema: z.object({ outcome: z.string().min(1).max(200) }),
    sample: { outcome: "We removed the content and warned the account." },
    subject: () => "An update on your report",
    preheader: () => "We reviewed your report.",
    heading: () => "We reviewed your report",
    paragraphs: (p) => [p.outcome],
    check: (p) => p.outcome,
  }),
  "contact-received": notice({
    id: "contact-received",
    schema: nameProps,
    sample: { name: "Tunde" },
    subject: () => "We got your message",
    preheader: () => "We will reply as soon as we can.",
    heading: (p) => `Thanks, ${p.name}`,
    paragraphs: () => [
      "We got your message and will reply to this email address, usually within a few working days.",
    ],
    check: (p) => p.name,
  }),
  "contact-inbox": notice({
    id: "contact-inbox",
    schema: z.object({
      name: z.string().min(1).max(60),
      email: z.string().email(),
      message: z.string().min(1).max(2000),
    }),
    sample: { name: "Tunde", email: "tunde@example.com", message: "My code did not arrive." },
    subject: (p) => `Contact form: ${p.name}`,
    preheader: (p) => p.message.slice(0, 90),
    heading: (p) => `Message from ${p.name}`,
    paragraphs: (p) => [`From: ${p.name} <${p.email}>`, p.message],
    check: (p) => p.message,
  }),
} as const;

export type TemplateId = keyof typeof templates;
