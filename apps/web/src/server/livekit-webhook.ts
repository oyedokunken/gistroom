import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** The webhook header is a short JWT signed with the API secret, carrying the SHA 256 of the body. */
export function verifyWebhook(
  authorization: string | null,
  body: string,
  secret: string,
  key: string,
): boolean {
  if (!authorization) return false;
  const token = authorization.replace(/^Bearer /i, "");
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) return false;
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const claims = JSON.parse(Buffer.from(p, "base64url").toString()) as {
      iss?: string;
      sha256?: string;
      exp?: number;
    };
    if (claims.iss !== key) return false;
    if (claims.exp && claims.exp * 1000 < Date.now()) return false;
    const digest = createHash("sha256").update(body).digest("base64");
    return (
      claims.sha256 === digest || claims.sha256 === createHash("sha256").update(body).digest("hex")
    );
  } catch {
    return false;
  }
}
