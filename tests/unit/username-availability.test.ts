import { describe, expect, it } from "vitest";
import {
  latestRun,
  localState,
  resolveUsername,
} from "../../apps/web/src/lib/username-availability";

const signal = new AbortController().signal;

describe("username availability states", () => {
  it("is idle when nothing is typed or the name is the person's own", () => {
    expect(localState("")).toEqual({ status: "idle" });
    expect(localState("  ")).toEqual({ status: "idle" });
    expect(localState("ada_eze", "ada_eze")).toEqual({ status: "idle" });
  });

  it("is invalid without asking the server when the rules are broken", () => {
    const short = localState("ab");
    expect(short?.status).toBe("invalid");
    expect(localState("has space")?.status).toBe("invalid");
    expect(localState("admin")?.status).toBe("invalid");
  });

  it("has nothing to say locally for a good name, so the server is asked", () => {
    expect(localState("ada_eze")).toBeNull();
    expect(localState("  Ada_Eze ")).toBeNull();
  });

  it("turns the server answer into available, taken or invalid", async () => {
    const free = await resolveUsername(
      "ada",
      async () => ({ available: true, reason: null }),
      signal,
    );
    const taken = await resolveUsername(
      "ada",
      async () => ({ available: false, reason: null }),
      signal,
    );
    const bad = await resolveUsername(
      "ada",
      async () => ({ available: false, reason: "Not allowed" }),
      signal,
    );
    expect(free).toEqual({ status: "available" });
    expect(taken).toEqual({ status: "taken" });
    expect(bad).toEqual({ status: "invalid", message: "Not allowed" });
  });

  it("is an error when the check fails, and aborted when it was cancelled", async () => {
    const failed = await resolveUsername(
      "ada",
      async () => {
        throw new Error("network");
      },
      signal,
    );
    expect(failed).toEqual({ status: "error" });
    const controller = new AbortController();
    controller.abort();
    const aborted = await resolveUsername(
      "ada",
      async () => {
        throw new DOMException("aborted", "AbortError");
      },
      controller.signal,
    );
    expect(aborted).toBe("aborted");
  });

  it("never lets a stale answer win", () => {
    const runs = latestRun();
    const first = runs.next();
    const second = runs.next();
    expect(runs.isLatest(first)).toBe(false);
    expect(runs.isLatest(second)).toBe(true);
  });
});
