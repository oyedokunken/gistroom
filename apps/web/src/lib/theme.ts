export const THEME_KEY = "gr_theme";
export type ThemePreference = "light" | "dark" | "system";

/** Light is the default for everyone (Decisions D24). Only "system" follows the device. */
export const DEFAULT_THEME: ThemePreference = "light";

export function resolveTheme(pref: ThemePreference, systemIsDark: boolean): "light" | "dark" {
  if (pref === "dark") return "dark";
  if (pref === "system") return systemIsDark ? "dark" : "light";
  return "light";
}

/** Runs before first paint so there is no flash. Mirrors resolveTheme, kept as a string for an inline script. */
export const themeInitScript = `(function(){var r=document.documentElement;try{var p=localStorage.getItem("${THEME_KEY}")||"${DEFAULT_THEME}";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);r.setAttribute("data-theme",d?"dark":"light")}catch(e){r.setAttribute("data-theme","light")}})()`;
