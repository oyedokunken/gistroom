import { afterEach, describe, expect, it, vi } from "vitest";
import { createScheduler } from "../../apps/realtime/src/scheduler";
import type { Delivery } from "../../apps/realtime/src/delivery";
import { FakeStore } from "../helpers/fake-store";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

function setup(
  opts: { deliver?: (id: string) => Promise<void>; expireCalls?: () => Promise<void> } = {},
) {
  const store = new FakeStore();
  const delivered: string[] = [];
  const delivery = {
    deliverNotification:
      opts.deliver ??
      (async (id: string) => {
        delivered.push(id);
      }),
  } as unknown as Delivery;
  const expireCalls = opts.expireCalls ?? vi.fn(async () => undefined);
  const scheduler = createScheduler({
    store,
    delivery,
    log: log as never,
    expireCalls,
    now: () => new Date("2026-11-09T12:00:00Z"),
    intervalMs: 1000,
  });
  return { store, scheduler, delivered, expireCalls };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("scheduler", () => {
  it("delivers each due notification job once and counts it", async () => {
    const { store, scheduler, delivered } = setup();
    store.addJob("j1", "n1").addJob("j2", "n2");
    expect(await scheduler.runOnce()).toBe(2);
    expect(delivered.sort()).toEqual(["n1", "n2"]);
    // The jobs are claimed, so a second poll finds nothing to do.
    expect(await scheduler.runOnce()).toBe(0);
    expect(delivered).toHaveLength(2);
  });

  it("leaves jobs that are not due yet", async () => {
    const { store, scheduler, delivered } = setup();
    store.addJob("later", "n3", new Date("2026-11-09T13:00:00Z"));
    expect(await scheduler.runOnce()).toBe(0);
    expect(delivered).toEqual([]);
  });

  it("wakes the web sweep for room and call jobs instead of delivering", async () => {
    const { store, scheduler, delivered, expireCalls } = setup();
    for (const kind of ["call-timeout", "room-empty", "room-remind", "room-due", "room-noshow"]) {
      store.jobs.set(kind, {
        id: kind,
        kind,
        payload: {},
        processedAt: null,
        dueAt: new Date(0),
        attempts: 0,
      });
    }
    expect(await scheduler.runOnce()).toBe(5);
    expect(expireCalls).toHaveBeenCalledTimes(5);
    expect(delivered).toEqual([]);
  });

  it("warns about a job kind nobody handles and does not retry it", async () => {
    const { store, scheduler } = setup();
    store.jobs.set("odd", {
      id: "odd",
      kind: "mystery",
      payload: {},
      processedAt: null,
      dueAt: new Date(0),
      attempts: 0,
    });
    await scheduler.runOnce();
    expect(log.warn).toHaveBeenCalledWith({ kind: "mystery" }, "no handler for scheduled job");
    expect(store.jobs.get("odd")?.processedAt).not.toBeNull();
  });

  it("puts a failed job back with a later due time and the error", async () => {
    const { store, scheduler } = setup({
      deliver: async () => {
        throw new Error("push service down");
      },
    });
    store.addJob("flaky", "n9");
    await scheduler.runOnce();
    const job = store.jobs.get("flaky")!;
    expect(job.processedAt).toBeNull();
    expect(job.attempts).toBe(1);
    expect(job.lastError).toContain("push service down");
    expect(job.dueAt.getTime()).toBeGreaterThan(new Date("2026-11-09T12:00:00Z").getTime());
  });

  it("drops a job after its last attempt and logs it", async () => {
    const { store, scheduler } = setup({
      deliver: async () => {
        throw new Error("still down");
      },
    });
    store.addJob("doomed", "n10");
    store.jobs.get("doomed")!.attempts = 4;
    await scheduler.runOnce();
    const job = store.jobs.get("doomed")!;
    expect(job.processedAt).not.toBeNull();
    expect(log.error).toHaveBeenCalledWith({ kind: "notify", jobId: "doomed" }, "job dropped");
  });

  it("logs and recovers when the poll itself fails, so the next poll still runs", async () => {
    const { store, scheduler } = setup();
    vi.spyOn(store, "dueJobs").mockRejectedValueOnce(new Error("db gone"));
    expect(await scheduler.runOnce()).toBe(0);
    expect(log.error).toHaveBeenCalledWith({ err: "Error: db gone" }, "scheduler poll failed");
    store.addJob("after", "n11");
    expect(await scheduler.runOnce()).toBe(1);
  });

  it("does not run two polls at once", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const { store, scheduler } = setup({ deliver: () => gate });
    store.addJob("slow", "n12");
    const first = scheduler.runOnce();
    expect(await scheduler.runOnce()).toBe(0);
    release();
    expect(await first).toBe(1);
  });

  it("polls at boot and on every interval until it is stopped", async () => {
    vi.useFakeTimers();
    const { store, scheduler } = setup();
    const poll = vi.spyOn(store, "dueJobs");
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(poll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(poll).toHaveBeenCalledTimes(3);
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(poll).toHaveBeenCalledTimes(3);
  });
});
