import { expect as baseExpect, test, type Page } from "@playwright/test";
import { getDb } from "@gistroom/db";
import { capturedCode, createUser, dbAvailable, signIn } from "./auth-helpers";

test.skip(!dbAvailable, "needs TEST_DATABASE_URL");

// Every change goes to a database in another country, and several tests share it.
const expect = baseExpect.configure({ timeout: 20_000 });
test.use({ viewport: { width: 1280, height: 900 } });

async function typeCode(page: Page, scope: ReturnType<Page["locator"]>, code: string) {
  await scope.getByLabel("Digit 1").click();
  await page.keyboard.type(code);
}

test.describe("settings, one by one", () => {
  test("profile: name, bio and a username that is checked live", async ({ page, context }) => {
    const me = await createUser("set1", { name: "Profile Person" });
    const other = await createUser("set2");
    await signIn(context, me);
    await page.goto("/app/settings/profile");

    // Wait for the form to be filled in by the page before typing, so typing cannot race hydration.
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Profile Person");
    await page.getByLabel("Name", { exact: true }).fill("Profile Renamed");
    await page.getByLabel("Bio").fill("I talk about football.");

    // Taken: the hint and the icon say so, and the save is refused by the server too.
    const username = page.getByLabel("Username");
    await username.fill(other.user.username);
    await expect(page.getByText("That username is taken")).toBeVisible();
    // Broken rule: said at once, nothing is sent.
    await username.fill("no");
    await expect(page.getByText(/letters, numbers or underscores/i).first()).toBeVisible();
    // Free: confirmed live.
    const fresh = `renamed_${Date.now().toString(36)}`.slice(0, 20);
    await username.fill(fresh);
    await expect(page.getByText(`@${fresh} is available`)).toBeVisible();

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Your profile is updated.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Profile Renamed");
    await expect(page.getByLabel("Bio")).toHaveValue("I talk about football.");
    await expect(page.getByLabel("Username")).toHaveValue(fresh);
    const row = await getDb().user.findUnique({ where: { id: me.user.id } });
    expect(row?.username).toBe(fresh);
  });

  test("privacy: switches are saved", async ({ page, context }) => {
    const me = await createUser("set3");
    await signIn(context, me);
    await page.goto("/app/settings/privacy");
    await page.getByRole("switch", { name: "Show me in search" }).click();
    await page.getByRole("switch", { name: "Send read receipts" }).click();
    await page.getByRole("button", { name: "Save privacy settings" }).click();
    await expect(page.getByText("Your privacy settings are updated.")).toBeVisible();
    const row = await getDb().user.findUnique({ where: { id: me.user.id } });
    expect(row?.discoverable).toBe(false);
    expect(row?.sendReadReceipts).toBe(false);
    await page.reload();
    await expect(page.getByRole("switch", { name: "Show me in search" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("interests: three to eight, and saved", async ({ page, context }) => {
    const me = await createUser("set4", { interests: ["football", "comedy", "gaming"] });
    await signIn(context, me);
    await page.goto("/app/settings/interests");
    const save = page.getByRole("button", { name: "Save interests" });
    await expect(save).toBeEnabled();
    // Down to two: the button turns off and the counter says why.
    await page.getByRole("button", { name: "Gaming", exact: true }).click();
    await expect(save).toBeDisabled();
    await expect(page.getByText("2 of 3 picked")).toBeVisible();
    await page.getByRole("button", { name: "Music and Gbedu" }).click();
    await page.getByRole("button", { name: "Parenting" }).click();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText("Your interests are saved.")).toBeVisible();
    const rows = await getDb().userInterest.findMany({ where: { userId: me.user.id } });
    expect(rows.map((r) => r.topicSlug).sort()).toEqual(
      ["comedy", "football", "music-and-gbedu", "parenting"].sort(),
    );
  });

  test("appearance and data saver: theme, calm mode and data saver stick", async ({
    page,
    context,
  }) => {
    const me = await createUser("set5");
    await signIn(context, me);
    await page.goto("/app/settings/appearance");
    await page.getByRole("radio", { name: /dark/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("switch", { name: "Reduce animations" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-calm", "");
    await page.getByRole("switch", { name: "Data saver" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Data saver setting saved.")).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const row = await getDb().user.findUnique({ where: { id: me.user.id } });
    expect(row?.dataSaver).toBe(false);
  });

  test("devices: says when it is the only one, and signs the others out", async ({
    page,
    context,
    browser,
  }) => {
    const me = await createUser("set6");
    await signIn(context, me);
    await page.goto("/app/settings/devices");
    await expect(page.getByText(/only device signed in/i)).toBeVisible();

    const second = await browser.newContext();
    await signIn(second, me);
    await page.reload();
    await expect(page.getByRole("button", { name: "Sign out everywhere else" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out everywhere else" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /sign out/i })
      .click();
    await expect(page.getByText(/signed out 1 other device/i)).toBeVisible();
    const other = await second.newPage();
    await other.goto("/app/discover");
    await expect(other).toHaveURL(/\/login/);
    await second.close();
  });

  test("security: change the password, then sign in with the new one", async ({
    page,
    context,
  }) => {
    const me = await createUser("set7");
    await signIn(context, me);
    await page.goto("/app/settings/security");
    await page.getByLabel("Current password").fill(me.password);
    await page.getByLabel("New password", { exact: true }).fill("short");
    await expect(page.getByRole("status", { name: /strength: Weak/i })).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill("Brand-new passphrase 2026!");
    await expect(page.getByRole("status", { name: /strength: Strong/i })).toBeVisible();
    await page.getByLabel("Type the new password again").fill("Brand-new passphrase 2026");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByText("The two passwords do not match.")).toBeVisible();
    await page.getByLabel("Type the new password again").fill("Brand-new passphrase 2026!");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByText("Your password is updated.")).toBeVisible();

    // Signed out, then in with the new password (email first, then password).
    await page.context().clearCookies();
    await context.addCookies([
      {
        name: "gr_consent",
        value: encodeURIComponent(JSON.stringify({ v: 2, functional: false, analytics: false })),
        url: "http://localhost:3217",
      },
    ]);
    await page.goto("/login");
    await page.getByLabel("Email or username").fill(me.user.username);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Password", { exact: true }).fill("Brand-new passphrase 2026!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/app\//);
  });

  test("security: change the email with a code sent to the new address", async ({
    page,
    context,
  }) => {
    const me = await createUser("set8");
    await signIn(context, me);
    await page.goto("/app/settings/security");
    const fresh = `e2e_new_${Date.now().toString(36)}@example.com`;
    await page.getByLabel("New email address").fill(fresh);
    const emailSection = page.locator("section[aria-labelledby=email-h]");
    await emailSection.getByLabel("Your password", { exact: true }).fill(me.password);
    await page.getByRole("button", { name: "Send a code to the new address" }).click();
    await expect(page.getByText(`We sent a 6 digit code to ${fresh}.`)).toBeVisible();
    await typeCode(
      page,
      page.getByRole("group", { name: "6 digit code" }),
      await capturedCode(fresh),
    );
    await page.getByRole("button", { name: "Confirm the new email" }).click();
    await expect(page.getByText(/Your email address is updated/)).toBeVisible();
    const row = await getDb().user.findUnique({ where: { id: me.user.id } });
    expect(row?.email).toBe(fresh);
  });

  test("data and account: export, then delete with a code", async ({ page, context }) => {
    const me = await createUser("set9");
    await signIn(context, me);
    await page.goto("/app/settings/account");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download my data" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe(`gistroom-${me.user.username}.json`);
    const path = await file.path();
    const { readFileSync } = await import("node:fs");
    const exported = JSON.parse(readFileSync(path, "utf8")) as { profile: { email: string } };
    expect(exported.profile.email).toBe(me.email);

    await page.getByRole("button", { name: "Delete my account" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Send me the code" }).click();
    await typeCode(page, dialog.getByRole("group", { name: "6 digit code" }), "000000");
    await dialog.getByLabel("Your password").fill(me.password);
    await dialog.getByRole("button", { name: "Delete my account for good" }).click();
    await expect(dialog.getByText(/not right|wrong|tries/i).first()).toBeVisible();

    await dialog.getByLabel("Digit 1").click();
    for (let i = 0; i < 6; i += 1) await page.keyboard.press("Backspace");
    await typeCode(
      page,
      dialog.getByRole("group", { name: "6 digit code" }),
      await capturedCode(me.email),
    );
    await dialog.getByRole("button", { name: "Delete my account for good" }).click();
    await expect(page).toHaveURL(/\/login/);
    const row = await getDb().user.findUnique({ where: { id: me.user.id } });
    expect(row?.status).toBe("DELETED");
  });
});
