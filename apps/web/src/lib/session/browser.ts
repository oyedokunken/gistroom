import { session } from "@/content/session";

/** Browsers built into other apps (Facebook, Instagram and the like) cannot run calls reliably. */
const IN_APP =
  /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|BytedanceWebview|LinkedInApp|Twitter|Pinterest|GSA\//i;

export function isInAppBrowser(ua: string): boolean {
  return IN_APP.test(ua);
}

export type BrowserFamily = "chrome" | "safari" | "firefox" | "other";

export function browserFamily(ua: string): BrowserFamily {
  if (/Firefox|FxiOS/i.test(ua)) return "firefox";
  if (/Edg|OPR|CriOS|Chrome|SamsungBrowser/i.test(ua)) return "chrome";
  if (/Safari/i.test(ua)) return "safari";
  return "other";
}

export type UnsupportedReason = "in-app" | "no-media" | null;

/**
 * Why this browser cannot join a call or room, or null when it can. An in-app browser is the usual cause and the fix is
 * to open the link in the real browser. A browser with no microphone support at all cannot be helped by a link.
 */
export function unsupportedReason(
  ua: string,
  hasMedia: boolean,
  hasPeerConnection: boolean,
): UnsupportedReason {
  if (isInAppBrowser(ua)) return "in-app";
  if (!hasMedia || !hasPeerConnection) return "no-media";
  return null;
}

/** Steps for turning a blocked microphone or camera back on, in the words of that browser. */
export function permissionSteps(ua: string): readonly string[] {
  const family = browserFamily(ua);
  if (family === "safari") return session.devices.stepsSafari;
  if (family === "firefox") return session.devices.stepsFirefox;
  return session.devices.stepsChrome;
}
