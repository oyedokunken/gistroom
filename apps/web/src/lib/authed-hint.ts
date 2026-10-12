/**
 * `gr_authed` is a hint, not a login. It holds no token and no name: just "1" when this browser signed in. Public pages
 * stay static and cacheable, so they read it on the client to pick "Open Gistroom" over "Enter Gistroom" with no layout
 * shift, then confirm with /api/auth/session. Nothing is trusted because of it.
 */
export const AUTHED_HINT_COOKIE = "gr_authed";

export function readAuthedHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c === `${AUTHED_HINT_COOKIE}=1`);
}

export function clearAuthedHint(): void {
  try {
    document.cookie = `${AUTHED_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    // The hint only chooses a button label, so a failure here changes nothing important.
  }
}
