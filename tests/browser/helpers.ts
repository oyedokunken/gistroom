import type { Page } from "@playwright/test";

export const PUBLIC_ROUTES = [
  "/",
  "/features",
  "/about",
  "/security",
  "/safety",
  "/install",
  "/rooms",
  "/support",
  "/privacy",
  "/terms",
  "/cookies",
  "/acceptable-use",
  "/changelog",
] as const;

export const WIDTHS = [320, 390, 768, 1440] as const;

/** Start every test with cookies decided, so the consent banner never sits on top of what is being measured. */
export async function decideCookies(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: "gr_consent",
      value: encodeURIComponent(JSON.stringify({ v: 2, functional: false, analytics: false })),
      url: "http://localhost:3217",
    },
  ]);
}

export async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem("gr_theme", t);
    } catch {
      // Storage may be blocked. The default theme is light.
    }
  }, theme);
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const intersects = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
}

/** Open a page and wait until the dev server has stopped reloading it, so measurements are stable. */
export async function openStable(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: "load" });
  // The dev server may reload a page once while it compiles. Wait that out, then measure.
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
}
