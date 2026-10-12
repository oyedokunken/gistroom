import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  analyticsAllowed,
  parseConsent,
  serializeConsent,
} from "../../apps/web/src/lib/consent";

describe("cookie consent", () => {
  const choice = { functional: true, analytics: false };

  it("reads back exactly what the server wrote, after the cookie writer encodes it once", () => {
    // Next percent encodes cookie values when it sets them, and the browser hands that text back.
    const onTheWire = encodeURIComponent(serializeConsent(choice));
    expect(parseConsent(onTheWire)).toEqual(choice);
  });

  it("still reads a value that an older version encoded twice", () => {
    const twice = encodeURIComponent(encodeURIComponent(serializeConsent(choice)));
    expect(parseConsent(twice)).toEqual(choice);
  });

  it("treats a missing, broken or older value as no choice yet", () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("nonsense")).toBeNull();
    const old = encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION - 1, ...choice }));
    expect(parseConsent(old)).toBeNull();
  });

  it("only allows analytics after an explicit yes", () => {
    expect(analyticsAllowed(null)).toBe(false);
    expect(analyticsAllowed(choice)).toBe(false);
    expect(analyticsAllowed({ functional: true, analytics: true })).toBe(true);
  });
});
