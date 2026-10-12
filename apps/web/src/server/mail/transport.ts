import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

export type MailTransportKind = "console" | "capture" | "smtp";

export interface MailConfig {
  transport: MailTransportKind;
  enableReal: boolean;
  allowedDomains: string[];
  nodeEnv: string;
  /** The public address of the app. Mail that only goes to a file is allowed when this is a local address. */
  appUrl: string;
  fromName: string;
  fromAddress: string;
  smtpUser?: string;
  smtpPassword?: string;
  captureDir: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class MailBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailBlockedError";
  }
}

export function mailConfigFromEnv(env: NodeJS.ProcessEnv): MailConfig {
  const transport = env.MAIL_TRANSPORT;
  return {
    transport: transport === "smtp" || transport === "capture" ? transport : "console",
    enableReal: env.MAIL_ENABLE_REAL === "true",
    allowedDomains: (env.MAIL_ALLOWED_DOMAINS ?? "example.com")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
    nodeEnv: env.NODE_ENV ?? "development",
    appUrl: env.APP_URL ?? "http://localhost:3000",
    fromName: env.MAIL_FROM_NAME ?? "Gistroom",
    fromAddress: env.MAIL_FROM_ADDRESS ?? env.SMTP_USER ?? "no-reply@gistroom.ng",
    smtpUser: env.SMTP_USER,
    smtpPassword: env.SMTP_APP_PASSWORD,
    captureDir: path.join(process.cwd(), ".mail-capture"),
  };
}

/** Outside production only allow-listed domains may receive mail, so a test can never reach a real inbox. */
export function checkRecipient(
  email: string,
  cfg: Pick<MailConfig, "nodeEnv" | "allowedDomains">,
): void {
  if (cfg.nodeEnv === "production") return;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!cfg.allowedDomains.includes(domain)) {
    throw new MailBlockedError(
      `Recipient domain "${domain}" is not in MAIL_ALLOWED_DOMAINS. Use an allowed domain outside production.`,
    );
  }
}

/** In memory copy of captured mail, read by tests and the browser suite. */
export const capturedMail: MailMessage[] = [];

export async function deliver(message: MailMessage, cfg: MailConfig): Promise<void> {
  checkRecipient(message.to, cfg);
  // A production build must send real mail. The browser tests run a production build on localhost and capture to a file.
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(cfg.appUrl);
  if (cfg.nodeEnv === "production" && cfg.transport !== "smtp" && !local) {
    throw new MailBlockedError("MAIL_TRANSPORT must be smtp in production.");
  }

  if (cfg.transport === "console") {
    process.stdout.write(`\n[mail] to ${message.to}: ${message.subject}\n${message.text}\n\n`);
    return;
  }

  if (cfg.transport === "capture") {
    capturedMail.push(message);
    await mkdir(cfg.captureDir, { recursive: true });
    const safe = message.to.replace(/[^a-z0-9@._-]/gi, "_");
    await writeFile(
      path.join(cfg.captureDir, `${Date.now()}-${safe}.json`),
      JSON.stringify(message, null, 2),
    );
    return;
  }

  if (!cfg.enableReal) {
    throw new MailBlockedError(
      "MAIL_ENABLE_REAL is not true, so the smtp transport is switched off.",
    );
  }
  if (!cfg.smtpUser || !cfg.smtpPassword) {
    throw new MailBlockedError(
      "SMTP_USER and SMTP_APP_PASSWORD are required for the smtp transport.",
    );
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: cfg.smtpUser, pass: cfg.smtpPassword },
  });
  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromAddress}>`,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
