/** Coarse, human readable device name from a user agent, for the Devices list. Never stores the raw agent in the UI. */
export function deviceLabel(userAgent: string): string {
  const ua = userAgent || "";
  let browser = "Browser";
  if (/SamsungBrowser\//i.test(ua)) browser = "Samsung Internet";
  else if (/Edg(e|A|iOS)?\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox\/|FxiOS\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\/|CriOS\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  let os = "an unknown device";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return `${browser} on ${os}`;
}
