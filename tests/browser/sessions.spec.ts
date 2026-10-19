import { expect as baseExpect, test } from "@playwright/test";
import { getDb } from "@gistroom/db";
import { BASE, createUser, E2E_PASSWORD, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 25_000 });

test.describe("sessions and alerts", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("signing in sets server cookies that last 30 days, and a device cookie that lasts a year", async ({
    request,
  }) => {
    const me = await createUser("ss1");
    const res = await request.post(`${BASE}/api/auth/login`, {
      headers: { origin: BASE },
      data: { email: me.email, password: E2E_PASSWORD },
    });
    expect(res.ok()).toBe(true);
    const cookies = res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .map((h) => h.value);
    const session = cookies.find((c) => c.startsWith("gr_session="));
    expect(session).toBeTruthy();
    expect(session).toContain("Max-Age=2592000");
    expect(session?.toLowerCase()).toContain("httponly");
    expect(session?.toLowerCase()).toContain("samesite=lax");
    expect(session).toContain("Path=/");
    expect(session).toContain("Expires=");
    const device = cookies.find((c) => c.startsWith("gr_device="));
    expect(device).toContain("Max-Age=31536000");
    expect(device?.toLowerCase()).toContain("httponly");
    // Every cookie we set comes from the server. None is created by a script.
    const hint = cookies.find((c) => c.startsWith("gr_authed="));
    expect(hint).toContain("Max-Age=2592000");
    const row = await getDb().session.findFirstOrThrow({ where: { userId: me.user.id } });
    expect(row.deviceId).toBeTruthy();
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 86_400_000);
  });

  test("a page load re-issues the cookie, and an expired session sends the person to sign in with next", async ({
    page,
    context,
  }) => {
    const me = await createUser("ss2");
    await signIn(context, me);
    const first = await page.goto("/app/chats");
    const renewed = (await first?.headersArray())?.filter(
      (h) => h.name.toLowerCase() === "set-cookie",
    );
    expect(
      renewed?.some(
        (h) => h.value.startsWith("gr_session=") && h.value.includes("Max-Age=2592000"),
      ),
    ).toBe(true);

    await getDb().session.updateMany({
      where: { userId: me.user.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await page.goto("/app/chats/some-chat-id");
    await page.waitForURL(/\/login/);
    const url = new URL(page.url());
    expect(url.searchParams.get("error")).toBe("session_expired");
    expect(url.searchParams.get("next")).toBe("/app/chats/some-chat-id");
    const ended = await getDb().session.findFirstOrThrow({ where: { userId: me.user.id } });
    expect(ended.endReason).toBe("EXPIRED");
    expect(ended.endedAt).not.toBeNull();
  });
});
