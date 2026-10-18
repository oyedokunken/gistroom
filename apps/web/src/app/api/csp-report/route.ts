import { clientIpFrom } from "@/server/http";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

/** Per instance limiter. The database backed limiter replaces it once rate limiting lands (Phase 1). */
function allowed(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5000) hits.clear();
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers);
  if (!allowed(ip)) return new Response(null, { status: 429 });
  // Reports are accepted and dropped for now. Structured logging arrives with the shared logger.
  const text = await request.text();
  if (text.length > 16_384) return new Response(null, { status: 413 });
  return new Response(null, { status: 204 });
}
