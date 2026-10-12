import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NET } from "../../apps/web/src/lib/session/config";
import {
  holdStart,
  holdStep,
  rawState,
  start,
  step,
  type NetSample,
} from "../../apps/web/src/lib/session/connection-machine";
import { CHIP_LIFETIME_MS, CHIP_MAX, useChips } from "../../apps/web/src/lib/session/chips";
import { pickCurrent, useSessionModals } from "../../apps/web/src/lib/session/modals";

const sample = (over: Partial<NetSample> = {}): NetSample => ({
  deviceOnline: true,
  apiReachable: true,
  serverError: false,
  recentRtts: [120, 140, 130],
  ...over,
});

describe("raw network state", () => {
  it("is online when the device and our server both answer", () => {
    expect(rawState(sample())).toBe("ONLINE");
  });

  it("is offline when the device says so", () => {
    expect(rawState(sample({ deviceOnline: false }))).toBe("OFFLINE");
  });

  it("is offline on a captive portal: the browser says online but our health check cannot get through", () => {
    expect(rawState(sample({ deviceOnline: true, apiReachable: false }))).toBe("OFFLINE");
  });

  it("does not call a server error offline: the device is fine and Gistroom is not", () => {
    expect(rawState(sample({ apiReachable: false, serverError: true }))).toBe("ONLINE");
  });

  it("is weak after three slow round trips in a row, not after one", () => {
    expect(rawState(sample({ recentRtts: [100, 2000, 100] }))).toBe("ONLINE");
    expect(rawState(sample({ recentRtts: [2000, 2100, 1800] }))).toBe("WEAK");
  });

  it("is weak on a very slow network type or when LiveKit says poor", () => {
    expect(rawState(sample({ effectiveType: "2g" }))).toBe("WEAK");
    expect(rawState(sample({ livekitPoor: true }))).toBe("WEAK");
  });

  it("is reconnecting while LiveKit reconnects", () => {
    expect(rawState(sample({ livekitReconnecting: true }))).toBe("RECONNECTING");
  });
});

describe("debounce", () => {
  it("ignores a one second blip", () => {
    let m = start(0);
    m = step(m, "OFFLINE", 1000);
    m = step(m, "OFFLINE", 2000);
    m = step(m, "ONLINE", 2500);
    expect(m.state).toBe("ONLINE");
  });

  it("shows offline only after it has held for three seconds", () => {
    let m = start(0);
    m = step(m, "OFFLINE", 1000);
    expect(m.state).toBe("ONLINE");
    m = step(m, "OFFLINE", 1000 + NET.showAfterMs);
    expect(m.state).toBe("OFFLINE");
  });

  it("needs two steady seconds online before it recovers, then shows RECOVERED for three seconds", () => {
    let m = start(0);
    m = step(m, "OFFLINE", 0);
    m = step(m, "OFFLINE", 3000);
    expect(m.state).toBe("OFFLINE");
    m = step(m, "ONLINE", 4000);
    m = step(m, "ONLINE", 5000);
    expect(m.state).toBe("OFFLINE");
    m = step(m, "ONLINE", 6000);
    expect(m.state).toBe("RECOVERED");
    m = step(m, "ONLINE", 6000 + NET.recoveredMs);
    expect(m.state).toBe("ONLINE");
  });

  it("remembers the last time we could reach the server", () => {
    let m = start(10);
    m = step(m, "OFFLINE", 100);
    m = step(m, "OFFLINE", 3100);
    expect(m.state).toBe("OFFLINE");
    expect(m.lastOnlineAt).toBeLessThan(3100);
  });

  it("holds a condition: on after three seconds, off after two", () => {
    let h = holdStart;
    h = holdStep(h, true, 0);
    h = holdStep(h, true, 2000);
    expect(h.on).toBe(false);
    h = holdStep(h, true, 3000);
    expect(h.on).toBe(true);
    h = holdStep(h, false, 3500);
    h = holdStep(h, false, 4400);
    expect(h.on).toBe(true);
    h = holdStep(h, false, 5500);
    expect(h.on).toBe(false);
  });

  it("does not flap: a condition that comes and goes never turns on", () => {
    let h = holdStart;
    for (let t = 0; t < 20_000; t += 1000) h = holdStep(h, Math.floor(t / 1000) % 2 === 0, t);
    expect(h.on).toBe(false);
  });
});

describe("session modals", () => {
  beforeEach(() => useSessionModals.setState({ list: [], counter: 0 }));

  const spec = (id: string, priority: Parameters<typeof pickCurrent>[0][number]["priority"]) => ({
    id,
    priority,
    title: id,
    body: id,
    icon: "alert" as const,
    actions: [{ id: "close", label: "Close", kind: "secondary" as const }],
  });

  it("shows the most urgent one and keeps the rest waiting", () => {
    const s = useSessionModals.getState();
    s.show(spec("offline", "offline"));
    s.show(spec("removed", "removed"));
    s.show(spec("blocked", "blocked"));
    expect(pickCurrent(useSessionModals.getState().list)?.id).toBe("removed");
    useSessionModals.getState().dismiss("removed");
    expect(pickCurrent(useSessionModals.getState().list)?.id).toBe("blocked");
  });

  it("drops a duplicate but keeps its words fresh", () => {
    const s = useSessionModals.getState();
    s.show(spec("net-offline", "offline"));
    s.show({ ...spec("net-offline", "offline"), body: "newer" });
    const list = useSessionModals.getState().list;
    expect(list).toHaveLength(1);
    expect(list[0]?.body).toBe("newer");
  });

  it("is first come first served among equals", () => {
    const s = useSessionModals.getState();
    s.show(spec("a", "info"));
    s.show(spec("b", "info"));
    expect(pickCurrent(useSessionModals.getState().list)?.id).toBe("a");
  });

  it("closes by itself when the condition clears and confirms it with a chip", () => {
    useChips.getState().clear();
    useSessionModals.getState().show(spec("net-offline", "offline"));
    useSessionModals.getState().clear("net-offline", { back: "You're back" });
    expect(useSessionModals.getState().list).toHaveLength(0);
    expect(useChips.getState().chips[0]?.text).toBe("You're back");
  });

  it("runs the onClose of a modal when it goes away", () => {
    const onClose = vi.fn();
    useSessionModals.getState().show({ ...spec("x", "info"), onClose });
    useSessionModals.getState().clear("x");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("activity chips", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useChips.getState().clear();
  });
  afterEach(() => vi.useRealTimers());

  it("shows the newest first and never more than three", () => {
    for (const n of ["one", "two", "three", "four"]) useChips.getState().push({ text: n });
    const texts = useChips.getState().chips.map((c) => c.text);
    expect(texts).toEqual(["four", "three", "two"]);
    expect(texts).toHaveLength(CHIP_MAX);
  });

  it("fades out by itself", () => {
    useChips.getState().push({ text: "Ada joined" });
    vi.advanceTimersByTime(CHIP_LIFETIME_MS + 10);
    expect(useChips.getState().chips).toHaveLength(0);
  });

  it("turns a burst into one chip with a count", () => {
    const many = (n: number) => `${n} people joined`;
    useChips.getState().push({ text: "Ada joined", key: "join", many });
    vi.advanceTimersByTime(500);
    useChips.getState().push({ text: "Bayo joined", key: "join", many });
    useChips.getState().push({ text: "Chidi joined", key: "join", many });
    const chips = useChips.getState().chips;
    expect(chips).toHaveLength(1);
    expect(chips[0]?.text).toBe("3 people joined");
  });

  it("starts a fresh chip once the burst window has passed", () => {
    const many = (n: number) => `${n} people joined`;
    useChips.getState().push({ text: "Ada joined", key: "join", many });
    vi.advanceTimersByTime(3500);
    useChips.getState().push({ text: "Bayo joined", key: "join", many });
    expect(useChips.getState().chips.some((c) => c.text === "Bayo joined")).toBe(true);
  });
});
