import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { site } from "@/content/site";
import { colors } from "@/lib/tokens";
import "./globals.css";

// Preload stays off: next/font cannot preload a subset of one family (Decisions D14).
const graphik = localFont({
  src: [
    { path: "../fonts/graphik/Graphik-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/graphik/Graphik-RegularItalic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/graphik/Graphik-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/graphik/Graphik-Semibold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/graphik/Graphik-Bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/graphik/Graphik-Black.woff2", weight: "900", style: "normal" },
    { path: "../fonts/graphik/Graphik-Super.woff2", weight: "950", style: "normal" },
  ],
  variable: "--font-graphik",
  display: "swap",
  preload: false,
  fallback: [
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Noto Sans",
    "Arial",
    "sans-serif",
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: "%s | Gistroom" },
  description: site.description,
  applicationName: site.name,
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "48x48" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "en_NG",
    images: [{ url: "/brand/og-default.png", width: 1200, height: 630, alt: site.tagline }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: colors.green600 },
    { media: "(prefers-color-scheme: dark)", color: colors.darkSurface },
  ],
};

// Nonce based CSP needs per-request rendering, so every page opts out of static prerendering.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading request headers also opts the page into per request rendering.
  const nonce = (await headers()).get("x-nonce");
  return (
    <html lang="en-NG" className={graphik.variable}>
      <head>
        {nonce ? (
          // Libraries that inject style tags (react-style-singleton behind Radix) read this global.
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: `window.__webpack_nonce__=${JSON.stringify(nonce)}`,
            }}
          />
        ) : null}
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
