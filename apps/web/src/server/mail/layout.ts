import { colors, emailFontStack } from "@/lib/tokens";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Builds an inline style string. Keys are camelCase CSS properties. */
export function css(rules: Record<string, string | number>): string {
  return Object.entries(rules)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(";");
}

export interface LayoutInput {
  appUrl: string;
  title: string;
  preheader: string;
  /** Trusted HTML for the body. Escape user values before they get here. */
  bodyHtml: string;
}

export const SUPPORT_EMAIL = "support@gistroom.ng";

const text = (extra: Record<string, string | number> = {}) =>
  css({
    fontFamily: emailFontStack,
    fontSize: "16px",
    lineHeight: "1.55",
    color: colors.ink950,
    ...extra,
  });

/**
 * Single column, table based, 600 pixels, inline CSS. A small dark mode block follows the
 * reader's setting where the client supports it (Section 19).
 */
export function renderLayout({ appUrl, title, preheader, bodyHtml }: LayoutInput): string {
  const link = (path: string, label: string) =>
    `<a href="${escapeHtml(appUrl)}${path}" style="${css({ color: colors.green700, textDecoration: "underline" })}">${label}</a>`;
  return `<!doctype html>
<html lang="en-NG">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
@media (prefers-color-scheme: dark) {
  .gr-bg { background-color: ${colors.darkSurface} !important; }
  .gr-card { background-color: ${colors.darkSurface2} !important; }
  .gr-text { color: ${colors.ink100} !important; }
  .gr-muted { color: ${colors.ink200} !important; }
  .gr-code { background-color: ${colors.darkSurface} !important; color: ${colors.white} !important; }
}
</style>
</head>
<body class="gr-bg" style="${css({ margin: 0, padding: 0, backgroundColor: colors.ink100 })}">
<div style="${css({ display: "none", maxHeight: 0, overflow: "hidden", opacity: 0 })}">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="gr-bg" style="${css({ backgroundColor: colors.ink100 })}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="${css({ width: "100%", maxWidth: "600px" })}">
<tr><td style="${css({ padding: "0 8px 16px" })}">
<img src="${escapeHtml(appUrl)}/brand/lockup-horizontal.png" width="176" height="41" alt="Gistroom" style="${css({ display: "block", border: 0 })}">
</td></tr>
<tr><td class="gr-card" style="${css({ backgroundColor: colors.white, borderRadius: "24px", padding: "32px" })}">
${bodyHtml}
</td></tr>
<tr><td style="${text({ fontSize: "13px", color: colors.ink500, padding: "20px 8px 0" })}" class="gr-muted">
<p style="margin:0 0 8px">Need help? Write to <a href="mailto:${SUPPORT_EMAIL}" style="${css({ color: colors.green700 })}">${SUPPORT_EMAIL}</a>.</p>
<p style="margin:0">${link("/privacy", "Privacy")} &middot; ${link("/terms", "Terms")} &middot; ${link("/acceptable-use", "Acceptable use")}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function paragraph(html: string): string {
  return `<p class="gr-text" style="${text({ margin: "0 0 16px" })}">${html}</p>`;
}

export function heading(value: string): string {
  return `<h1 class="gr-text" style="${text({ fontSize: "26px", lineHeight: "1.2", fontWeight: 700, margin: "0 0 16px" })}">${escapeHtml(value)}</h1>`;
}

/** Big readable code block for OTP emails. */
export function codeBlock(code: string): string {
  return `<div class="gr-code" style="${css({
    fontFamily: emailFontStack,
    fontSize: "36px",
    fontWeight: 700,
    letterSpacing: "10px",
    textAlign: "center",
    backgroundColor: colors.green100,
    color: colors.green700,
    borderRadius: "16px",
    padding: "18px 12px",
    margin: "8px 0 20px",
  })}">${escapeHtml(code)}</div>`;
}

/** A bulletproof call to action button for email clients: a table cell with a link inside. */
export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px"><tr><td style="${css({ backgroundColor: colors.green600, borderRadius: "999px" })}"><a href="${escapeHtml(href)}" style="${css({ display: "inline-block", padding: "14px 28px", fontFamily: emailFontStack, fontSize: "16px", fontWeight: 700, color: colors.white, textDecoration: "none" })}">${escapeHtml(label)}</a></td></tr></table>`;
}
