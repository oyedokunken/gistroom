import type { Delivery } from "./delivery";
import type { Logger } from "./sockets";
import type { Store } from "./store";

export interface SchedulerDeps {
  store: Store;
  delivery: Delivery;
  log: Logger;
  intervalMs?: number;
  now?: () => Date;
  /** Asks the web app to finish calls whose ring has run out. */
  expireCalls?: () => Promise<void>;
}

/**
 * Polls ScheduledJob for due work and processes it idempotently (Section 10.5). It also runs once at boot,
 * so nothing is lost across a Render sleep or restart.
 */
export function createScheduler(deps: SchedulerDeps) {
  const { store, delivery, log } = deps;
  const now = deps.now ?? (() => new Date());
  let timer: NodeJS.Timeout | undefined;
  let running = false;

  async function runOnce(): Promise<number> {
    if (running) return 0;
    running = true;
    let handled = 0;
    try {
      const jobs = await store.dueJobs(now(), 100);
      for (const job of jobs) {
        // Whoever wins the claim runs the job. A second poll or a direct hint finds it already taken.
        if (!(await store.claimJob(job.id))) continue;
        handled += 1;
        try {
          const payload = (job.payload ?? {}) as { notificationId?: string };
          if (job.kind === "notify" && payload.notificationId) {
            await delivery.deliverNotification(payload.notificationId);
          } else if (job.kind === "call-timeout" || job.kind === "room-empty") {
            await deps.expireCalls?.();
          } else {
            log.warn({ kind: job.kind }, "no handler for scheduled job");
          }
        } catch (error) {
          log.error({ err: String(error), kind: job.kind }, "job failed");
        }
      }
    } catch (error) {
      log.error({ err: String(error) }, "scheduler poll failed");
    } finally {
      running = false;
    }
    return handled;
  }

  return {
    runOnce,
    start() {
      void runOnce();
      timer = setInterval(() => void runOnce(), deps.intervalMs ?? 30_000);
    },
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}
