/**
 * Theme choice for the new look: Light (default), Dark, or Match system.
 *
 * The choice lives in localStorage; <html data-theme> carries what is painted. The server always
 * renders "light"; THEME_INIT_SCRIPT runs in <head> and corrects it before first paint, so there
 * is no flash. `color-scheme` follows through CSS (globals.css, "NEXT LOOK").
 *
 * No "use client" and no window access at module scope: the root layout imports the script
 * string on the server.
 */

export const THEME_STORAGE_KEY = "maven-theme";
/** Fired on `window` after the choice changes in this tab. */
export const THEME_EVENT = "maven-theme-change";

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type ResolvedTheme = "light" | "dark";

function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === "system") return systemPrefersDark ? "dark" : "light";
  return choice;
}

/** The stored choice. Light when nothing valid is stored or storage is blocked. */
export function readThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

function systemPrefersDark(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Paint `choice` on <html> without storing it. */
export function paintTheme(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice, systemPrefersDark());
  document.documentElement.setAttribute("data-theme", resolved);
  return resolved;
}

/** Store `choice`, paint it, and tell this tab's listeners. */
export function applyThemeChoice(choice: ThemeChoice): ResolvedTheme {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked (private mode): the choice still applies for this page.
  }
  const resolved = paintTheme(choice);
  window.dispatchEvent(new Event(THEME_EVENT));
  return resolved;
}

/**
 * Inline <head> script. Plain ES5, no dependencies, wrapped in try/catch: it must never stop
 * the page. It only acts when a choice other than the default is stored.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_STORAGE_KEY}");var d=c==="dark"||(c==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})();`;
