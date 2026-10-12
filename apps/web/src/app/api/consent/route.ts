import { z } from "zod";
import { cookies } from "next/headers";
import { getDb } from "@gistroom/db";
import { CONSENT_COOKIE, parseConsent, serializeConsent, type Consent } from "@/lib/consent";
import { getSessionContext } from "@/server/auth/session";
import { api, json, parseJson } from "@/server/http";

const schema = z.object({ functional: z.boolean(), analytics: z.boolean() });

/** Secure on https, which is every real visit. A plain http address such as localhost cannot keep a Secure cookie. */
function cookieOptions(request: Request) {
  const https =
    request.headers.get("x-forwarded-proto") === "https" ||
    new URL(request.url).protocol === "https:";
  return { sameSite: "lax" as const, path: "/", maxAge: 365 * 86_400, secure: https };
}

/** The signed in person's saved choice, if there is one. No cookie is needed to ask. */
async function savedChoice(): Promise<Consent | null> {
  const ctx = await getSessionContext().catch(() => null);
  if (!ctx) return null;
  return parseConsent(JSON.stringify(ctx.user.cookieConsent ?? null));
}

/**
 * Stores the visitor's cookie choices for a year on this host. Readable by the page so the banner can hide itself.
 * Signed in people also have it saved on their account, so a new device does not ask again.
 */
export const POST = api(async (request) => {
  const choice = await parseJson(request, schema);
  (await cookies()).set(CONSENT_COOKIE, serializeConsent(choice), cookieOptions(request));
  const ctx = await getSessionContext().catch(() => null);
  if (ctx) {
    await getDb().user.update({
      where: { id: ctx.user.id },
      data: { cookieConsent: JSON.parse(serializeConsent(choice)) },
    });
  }
  return json({ ok: true });
});

/** On a device with no cookie, restore the choice saved on the account and set the cookie again. */
export const GET = api(async (request) => {
  const saved = await savedChoice();
  if (!saved) return json({ consent: null });
  (await cookies()).set(CONSENT_COOKIE, serializeConsent(saved), cookieOptions(request));
  return json({ consent: saved });
});
