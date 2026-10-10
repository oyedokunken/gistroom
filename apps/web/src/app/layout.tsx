import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: colors.green600 },
    { media: "(prefers-color-scheme: dark)", color: colors.darkSurface },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={graphik.variable}>
      <body>{children}</body>
    </html>
  );
}
