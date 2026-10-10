import { describe, expect, it } from "vitest";
import {
  anniversaryDecision,
  nextAnniversary,
  yearsBetween,
} from "../../apps/web/src/server/friends/anniversary";

const d = (s: string) => new Date(`${s}T10:00:00Z`);

describe("yearsBetween", () => {
  it("counts whole years only", () => {
    expect(yearsBetween(d("2025-03-10"), d("2026-03-09"))).toBe(0);
    expect(yearsBetween(d("2025-03-10"), d("2026-03-10"))).toBe(1);
    expect(yearsBetween(d("2020-03-10"), d("2026-10-10"))).toBe(6);
  });
});

describe("nextAnniversary", () => {
  it("is the same day next year, never the start day itself", () => {
    expect(nextAnniversary(d("2025-03-10"), d("2025-03-10")).toISOString().slice(0, 10)).toBe(
      "2026-03-10",
    );
    expect(nextAnniversary(d("2025-03-10"), d("2026-03-11")).toISOString().slice(0, 10)).toBe(
      "2027-03-10",
    );
  });
  it("uses 28 February in years without a leap day", () => {
    expect(nextAnniversary(d("2024-02-29"), d("2024-03-01")).toISOString().slice(0, 10)).toBe(
      "2025-02-28",
    );
  });
});

describe("anniversaryDecision", () => {
  const since = d("2025-03-10");
  it("waits until the day arrives", () => {
    const r = anniversaryDecision({
      since,
      nextAt: null,
      celebratedYears: 0,
      now: d("2026-03-01"),
    });
    expect(r.celebrate).toBe(false);
  });
  it("celebrates once on the day and schedules the next year", () => {
    const r = anniversaryDecision({
      since,
      nextAt: null,
      celebratedYears: 0,
      now: d("2026-03-10"),
    });
    expect(r).toMatchObject({ celebrate: true, years: 1 });
    expect(r.nextAt.toISOString().slice(0, 10)).toBe("2027-03-10");
  });
  it("does not celebrate a year twice", () => {
    const r = anniversaryDecision({
      since,
      nextAt: new Date("2026-03-10T06:00:00Z"),
      celebratedYears: 1,
      now: d("2026-03-12"),
    });
    expect(r.celebrate).toBe(false);
  });
  it("celebrates the latest year when the app was not opened for a while", () => {
    const r = anniversaryDecision({
      since,
      nextAt: new Date("2026-03-10T06:00:00Z"),
      celebratedYears: 0,
      now: d("2026-07-01"),
    });
    expect(r).toMatchObject({ celebrate: true, years: 1 });
  });
});
