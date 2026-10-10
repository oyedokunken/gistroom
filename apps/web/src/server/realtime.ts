import type { InternalEvent } from "@gistroom/shared";
import { getEnv } from "./env";

/**
 * Tell the realtime service something changed. Postgres is the source of truth, so a failure here only
 * delays a live nudge: clients resync by cursor and a ScheduledJob catches missed notifications (Section 10.5).
 */
export async function publish(event: InternalEvent): Promise<boolean> {
  const env = getEnv();
  try {
    const res = await fetch(`${env.REALTIME_URL}/internal/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
      },
      body: JSON.stringify(event),
      // A sleeping Render instance can take a while to wake. Do not make a person wait for it.
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}
