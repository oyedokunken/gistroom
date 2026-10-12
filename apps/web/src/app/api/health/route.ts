import { getDb } from "@gistroom/db";

export const dynamic = "force-dynamic";

/**
 * Liveness plus a tiny database read. The read keeps the free Supabase project from pausing for inactivity,
 * and a database problem shows as `db: false` without failing the health check itself.
 */
/** A bare answer for the connection check that every open tab makes every 10 seconds. No database read. */
export function HEAD() {
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  let db = true;
  try {
    await getDb().topic.findFirst({ select: { id: true } });
  } catch {
    db = false;
  }
  return Response.json({ ok: true, service: "web", db, time: new Date().toISOString() });
}
