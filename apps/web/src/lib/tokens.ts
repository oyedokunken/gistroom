/** Design tokens (R11). CSS variables in globals.css mirror these values. */
export const colors = {
  green600: "#0E7A43",
  green700: "#0A5C32",
  green100: "#E4F4EB",
  yellow400: "#FFC20E",
  yellow100: "#FFF4CC",
  ink950: "#0B0B0C",
  ink700: "#3A3A3F",
  ink500: "#6B6B72",
  ink200: "#E3E3E6",
  ink100: "#F1F1F3",
  white: "#FFFFFF",
  danger600: "#C62828",
  darkSurface: "#0F1210",
  darkSurface2: "#171B18",
} as const;

export const radii = { input: 10, button: 9999, bubble: 18, card: 24, hero: 32 } as const;

export const fontStack =
  'var(--font-graphik), "Noto Sans Gistroom", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif';

/** Email clients cannot load Graphik, so emails use the system stack (Section 14). */
export const emailFontStack =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', Arial, sans-serif";

export const SITE = { name: "Gistroom", url: "https://gistroom.ng", locale: "en-NG" } as const;
