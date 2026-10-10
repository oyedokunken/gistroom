import { z } from "zod";
import { cookies } from "next/headers";
import { CONSENT_COOKIE, serializeConsent } from "@/lib/consent";
import { api, json, parseJson } from "@/server/http";

const schema = z.object({ functional: z.boolean(), analytics: z.boolean() });

/** Stores the visitor's cookie choices for a year. Readable by the page so the banner can hide itself. */
export const POST = api(async (request) => {
  const choice = await parseJson(request, schema);
  (await cookies()).set(CONSENT_COOKIE, serializeConsent(choice), {
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 86_400,
    secure: process.env.NODE_ENV === "production",
  });
  return json({ ok: true });
});
