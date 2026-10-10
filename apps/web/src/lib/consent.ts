export interface Consent {
  functional: boolean;
  analytics: boolean;
}

export const CONSENT_COOKIE = "gr_consent";

/** Parses the cookie value. Anything unreadable counts as no choice made yet. */
export function parseConsent(value: string | undefined | null): Consent | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<Consent> & { v?: number };
    if (
      parsed.v !== 1 ||
      typeof parsed.functional !== "boolean" ||
      typeof parsed.analytics !== "boolean"
    )
      return null;
    return { functional: parsed.functional, analytics: parsed.analytics };
  } catch {
    return null;
  }
}

export function serializeConsent(c: Consent): string {
  return encodeURIComponent(JSON.stringify({ v: 1, ...c }));
}

/** Analytics only ever loads after an explicit yes (Section 13). */
export function analyticsAllowed(c: Consent | null): boolean {
  return c?.analytics === true;
}
