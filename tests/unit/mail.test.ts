import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkText } from "../../scripts/lib/copy-rules.mjs";
import { escapeHtml } from "../../apps/web/src/server/mail/layout";
import { sendTemplate } from "../../apps/web/src/server/mail/send";
import { templates } from "../../apps/web/src/server/mail/templates";
import {
  capturedMail,
  checkRecipient,
  deliver,
  MailBlockedError,
  type MailConfig,
} from "../../apps/web/src/server/mail/transport";

const ctx = { appUrl: "https://gistroom.ng" };
const base: MailConfig = {
  transport: "capture",
  enableReal: false,
  allowedDomains: ["example.com"],
  nodeEnv: "test",
  fromName: "Gistroom",
  fromAddress: "no-reply@gistroom.ng",
  captureDir: "",
};

afterEach(() => {
  capturedMail.length = 0;
});

describe("templates", () => {
  for (const t of Object.values(templates)) {
    describe(t.id, () => {
      const out = t.render(t.sample as never, ctx);

      it("has a plain subject, html and a text alternative", () => {
        expect(out.subject).toBe("Your Gistroom code");
        expect(out.html).toContain("<!doctype html>");
        expect(out.text).toContain("042917");
      });
      it("passes the copy linter in html and text", () => {
        expect(checkText(out.html)).toEqual([]);
        expect(checkText(out.text)).toEqual([]);
        expect(checkText(out.subject)).toEqual([]);
      });
      it("is table based with the 600 pixel width and no external fonts or scripts", () => {
        expect(out.html).toContain('width="600"');
        expect(out.html).not.toMatch(/<script|fonts\.googleapis|@import/);
      });
      it("has well formed style attributes (no stray quotes)", () => {
        const attrs = [...out.html.matchAll(/style="([^"]*)"/g)].map((m) => m[1] ?? "");
        expect(attrs.length).toBeGreaterThan(5);
        // Every attribute value must be CSS only: property:value pairs and nothing that looks like markup.
        for (const a of attrs) expect(a).toMatch(/^[a-z-]+:[^<>]*$/);
        expect(out.html).not.toMatch(/style="[^"]*"[A-Za-z]/);
      });
      it("rejects bad props", () => {
        expect(t.schema.safeParse({ code: "12" }).success).toBe(false);
      });
    });
  }

  it("escapes html", () => {
    expect(escapeHtml(`<b onclick="x">&'`)).toBe("&lt;b onclick=&quot;x&quot;&gt;&amp;&#39;");
  });
});

describe("recipient guard", () => {
  it("blocks other domains outside production", () => {
    expect(() => checkRecipient("a@gmail.com", base)).toThrow(MailBlockedError);
    expect(() => checkRecipient("a@example.com", base)).not.toThrow();
    expect(() => checkRecipient("A@EXAMPLE.COM", base)).not.toThrow();
  });
  it("lets any recipient through in production", () => {
    expect(() => checkRecipient("a@gmail.com", { ...base, nodeEnv: "production" })).not.toThrow();
  });
});

describe("deliver", () => {
  it("captures without touching the network", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "gr-mail-"));
    try {
      await sendTemplate(
        "login-otp",
        "t@example.com",
        { code: "123456" },
        { config: { ...base, captureDir: dir } },
      );
      expect(capturedMail).toHaveLength(1);
      expect(capturedMail[0]?.text).toContain("123456");
      expect(await readdir(dir)).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("refuses smtp unless real mail is enabled", async () => {
    const msg = { to: "t@example.com", subject: "s", html: "h", text: "t" };
    await expect(deliver(msg, { ...base, transport: "smtp" })).rejects.toThrow(/MAIL_ENABLE_REAL/);
    await expect(deliver(msg, { ...base, transport: "smtp", enableReal: true })).rejects.toThrow(
      /SMTP_USER/,
    );
  });
  it("refuses console and capture in production", async () => {
    const msg = { to: "t@example.com", subject: "s", html: "h", text: "t" };
    await expect(
      deliver(msg, { ...base, nodeEnv: "production", transport: "console" }),
    ).rejects.toThrow(/smtp/);
  });
  it("fails loudly on bad props instead of queueing", async () => {
    await expect(
      sendTemplate("verify-otp", "t@example.com", { code: "x" } as never, { config: base }),
    ).rejects.toThrow();
  });
});
