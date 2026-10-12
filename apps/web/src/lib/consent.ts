export interface Consent {
  functional: boolean;
  analytics: boolean;
}

export const CONSENT_COOKIE = "gr_consent";

/**
 * Bump this only when the categories change. A person who already chose is asked again only then, and never
 * because of a new deploy, a new tab or a service worker update.
 */
export const CONSENT_VERSION = 2;

/** Decode up to twice, so a cookie that was encoded two times by an older version still reads. */
function decode(value: string): string {
  let out = value;
  for (let i = 0; i < 2 && out.startsWith("%"); i++) {
    try {
      out = decodeURIComponent(out);
    } catch {
      break;
    }
  }
  return out;
}

/** Parses the cookie value. Anything unreadable, or from an older set of categories, counts as no choice yet. */
export function parseConsent(value: string | undefined | null): Consent | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decode(value)) as Partial<Consent> & { v?: number };
    if (
      parsed.v !== CONSENT_VERSION ||
      typeof parsed.functional !== "boolean" ||
      typeof parsed.analytics !== "boolean"
    )
      return null;
    return { functional: parsed.functional, analytics: parsed.analytics };
  } catch {
    return null;
  }
}

/**
 * The cookie value as plain JSON. The cookie writer percent encodes it once, which is exactly what the reader undoes.
 * (Encoding here as well made the value unreadable and the banner came back every time.)
 */
export function serializeConsent(c: Consent): string {
  return JSON.stringify({ v: CONSENT_VERSION, functional: c.functional, analytics: c.analytics });
}

/** Analytics only ever loads after an explicit yes (Section 13). */
export function analyticsAllowed(c: Consent | null): boolean {
  return c?.analytics === true;
}
