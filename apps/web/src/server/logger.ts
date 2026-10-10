import pino from "pino";

/** Structured logs for the web app. Secrets, cookies and emails never reach them (Section 20). */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["*.token", "*.password", "*.email", "req.headers.authorization", "req.headers.cookie"],
});
