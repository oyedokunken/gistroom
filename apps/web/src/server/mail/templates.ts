import { z } from "zod";
import { LIMITS } from "@gistroom/shared";
import { button, codeBlock, escapeHtml, heading, paragraph, renderLayout } from "./layout";

export interface RenderContext {
  appUrl: string;
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
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
}

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
        action ? button(`${appUrl}${action.path}`, action.label) : "",
        ...(c.after?.(p) ?? []).map((t) => paragraph(escapeHtml(t))),
      ]
        .filter(Boolean)
        .join("\n");
      const text = [
        c.heading(p),
        "",
        ...c.paragraphs(p).flatMap((t) => [t, ""]),
        ...(code ? [`Your code: ${code}`, ""] : []),
        ...(action ? [`${action.label}: ${appUrl}${action.path}`, ""] : []),
        ...(c.after?.(p) ?? []).flatMap((t) => [t, ""]),
      ]
        .join("\n")
        .trim();
      return {
        subject,
        html: renderLayout({ appUrl, title: subject, preheader: c.preheader(p), bodyHtml }),
        text,
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
    schema: nameProps,
    sample: { name: "Tunde" },
    subject: () => "Welcome to Gistroom",
    preheader: () => "You are in. Find your people.",
    heading: (p) => `You are in, ${p.name}`,
    paragraphs: () => [
      "Your account is ready. Find your friends, start a room or drop into one already going.",
      "Turn on alerts so calls and messages reach you even when the app is closed.",
    ],
    action: () => ({ label: "Open Gistroom", path: "/app/chats" }),
    check: (p) => p.name,
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
    check: (p) => p.username,
  }),
  "room-invite": notice({
    id: "room-invite",
    schema: z.object({
      name: z.string().min(1).max(60),
      title: z.string().min(1).max(80),
      path: z.string().startsWith("/app/"),
    }),
    sample: { name: "Ada", title: "Match day gist", path: "/app/rooms/abc123" },
    subject: (p) => `${p.name} invited you to a room`,
    preheader: (p) => `${p.title}`,
    heading: (p) => p.title,
    paragraphs: (p) => [`${p.name} invited you to join this room.`],
    action: (p) => ({ label: "Join the room", path: p.path }),
    check: (p) => p.title,
  }),
  "room-starting-soon": notice({
    id: "room-starting-soon",
    schema: z.object({ title: z.string().min(1).max(80), path: z.string().startsWith("/app/") }),
    sample: { title: "Match day gist", path: "/app/rooms/abc123" },
    subject: (p) => `${p.title} starts soon`,
    preheader: () => "Your room starts in a few minutes.",
    heading: (p) => `${p.title} starts soon`,
    paragraphs: () => ["The room you are going to starts in a few minutes."],
    action: (p) => ({ label: "Open the room", path: p.path }),
    check: (p) => p.title,
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
