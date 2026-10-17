// Site color theme. Dark is the default; light is opt-in from the theme
// toggle. The choice lives in a cookie so the server renders the right theme
// on the first paint (no dark flash before switching to light).
export type ColorTheme = "dark" | "light";

export const THEME_COOKIE = "cardmart-theme";
export const DEFAULT_THEME: ColorTheme = "dark";

export function isColorTheme(value: string | null | undefined): value is ColorTheme {
  return value === "dark" || value === "light";
}
