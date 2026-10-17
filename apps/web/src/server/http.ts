import { cookies, headers } from "next/headers";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { errors, type ApiErrorBody, type ApiErrorCode } from "@gistroom/shared";
import { getAppUrl } from "./env";
import { isAllowedOrigin, isOriginOnHost } from "./auth/tokens";

/** A failure the client should see. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly extra: { fields?: Record<string, string>; retryAfterSec?: number } = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = () => new AppError(401, "UNAUTHORIZED", errors.unauthorized);
export const forbidden = (message: string = errors.forbidden) =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (message: string = errors.notFound) =>
  new AppError(404, "NOT_FOUND", message);
export const conflict = (message: string, fields?: Record<string, string>) =>
  new AppError(409, "CONFLICT", message, { fields });
export const rateLimited = (retryAfterSec: number) =>
  new AppError(429, "RATE_LIMITED", errors.rateLimited(retryAfterSec), { retryAfterSec });

export function json<T>(data: T, init: { status?: number; headers?: HeadersInit } = {}): Response {
  return Response.json(data, { status: init.status ?? 200, headers: init.headers });
}

export function errorResponse(error: AppError): Response {
  const body: ApiErrorBody = {
    error: { code: error.code, message: error.message, ...error.extra },
  };
  const headers: Record<string, string> = {};
  if (error.extra.retryAfterSec) headers["Retry-After"] = String(error.extra.retryAfterSec);
  return Response.json(body, { status: error.status, headers });
}

/** Maps Zod issues to one message per field for inline form errors (R4). */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

export interface ApiOptions {
  /**
   * "origin" (the default) runs the same-origin check on every mutating method, with or without a body.
   * "none" skips it and is only for routes that are called by a server, not a browser, and that verify their own
   * credential before doing anything: the LiveKit webhook (signature) and the sweep (bearer secret). Every route
   * that opts out is listed in tests/unit/route-csrf.test.ts, which also proves it rejects an unauthenticated call.
   */
  csrf?: "origin" | "none";
}

/**
 * Wrap a route handler. Mutating requests (POST, PUT, PATCH, DELETE) must pass the same-origin check (Section 6.2)
 * unless the route opts out. Known errors keep their message, unknown ones are logged by status only.
 */
export function api<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
  options: ApiOptions = {},
): (request: Request, ...args: Args) => Promise<Response> {
  const csrf = options.csrf ?? "origin";
  return async (request, ...args) => {
    try {
      if (csrf === "origin") assertSameOrigin(request);
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof AppError) return errorResponse(error);
      if (error instanceof ZodError) {
        return errorResponse(
          new AppError(400, "INVALID", errors.invalidRequest, { fields: fieldErrors(error) }),
        );
      }
      // Outside production the message helps; in production only the error name is logged.
      const detail =
        process.env.NODE_ENV !== "production" && error instanceof Error
          ? `: ${error.message.slice(0, 300)}`
          : "";
      process.stderr.write(
        `api error: ${error instanceof Error ? error.name : "unknown"}${detail}\n`,
      );
      return errorResponse(new AppError(500, "SERVER", errors.server));
    }
  };
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF defence: SameSite=Lax plus an Origin check on every mutating request (Section 6.2). Called by api(), not by
 * route handlers. A browser that says the request is cross-site is refused even before the Origin header is read.
 */
export function assertSameOrigin(request: Request): void {
  if (!MUTATING.has(request.method)) return;
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AppError(403, "ORIGIN", errors.originMismatch);
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!isAllowedOrigin(origin, getAppUrl()) && !isOriginOnHost(origin, host)) {
    throw new AppError(403, "ORIGIN", errors.originMismatch);
  }
}

export async function parseJson<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError(400, "INVALID", errors.invalidRequest);
  }
  return schema.parse(body);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export async function userAgent(): Promise<string> {
  return (await headers()).get("user-agent") ?? "";
}

export async function readCookie(name: string): Promise<string | undefined> {
  return (await cookies()).get(name)?.value;
}
