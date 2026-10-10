"use client";

import { serverError as copy } from "@/content/site";
import { colors, emailFontStack } from "@/lib/tokens";

/**
 * Last resort when the root layout itself fails. It brings its own html and body, so it uses inline
 * style attributes (allowed by the CSP) and system fonts, and it never pulls in the public chrome.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-NG">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "2rem",
          textAlign: "center",
          background: colors.white,
          color: colors.ink950,
          fontFamily: emailFontStack,
        }}
      >
        <img
          src="/brand/lockup-stacked.png"
          alt="Gistroom"
          style={{ width: 150, height: "auto" }}
        />
        <h1 style={{ fontSize: "2rem", margin: 0 }}>{copy.heading}</h1>
        <p style={{ margin: 0, color: colors.ink700 }}>{copy.body}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: 48,
            padding: "0 1.75rem",
            borderRadius: 999,
            border: 0,
            background: colors.green600,
            color: colors.white,
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {copy.retry}
        </button>
      </body>
    </html>
  );
}
