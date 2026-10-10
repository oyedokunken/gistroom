import type { ApiErrorBody, ApiErrorCode } from "@gistroom/shared";
import { network } from "@/content/errors";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode | "NETWORK",
    message: string,
    public readonly fields: Record<string, string> = {},
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** Typed JSON fetch. Same origin, so the browser sends the cookie and the Origin header the server checks. */
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiClientError(0, "NETWORK", network.offline);
  }
  if (res.ok) return (await res.json()) as T;
  let body: Partial<ApiErrorBody> = {};
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // Non JSON error bodies fall through to the generic message.
  }
  const err = body.error;
  throw new ApiClientError(
    res.status,
    err?.code ?? "SERVER",
    err?.message ?? network.server,
    err?.fields,
    err?.retryAfterSec,
  );
}
