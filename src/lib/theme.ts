/**
 * Theme resolution.
 *
 * Plumbing for the planned UI overhaul: this decides and applies which theme
 * is active. Actually styling the components in dark mode belongs to the
 * overhaul — the point of doing this first is that the overhaul can style
 * against a theme that already switches.
 *
 * Three states, stored in two columns' worth of space. `user_settings.
 * dark_mode` is a nullable boolean, so it already expresses everything
 * needed without a schema change:
 *
 *   null   follow the device
 *   true   always dark
 *   false  always light
 *
 * "Follow the device" is the default deliberately. Someone whose phone
 * switches to dark at sunset expects an app opened in a dim gym to do the
 * same, and never having chosen is different from having chosen light.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** Mirrors the resolved theme so it can be applied before React mounts. */
export const THEME_STORAGE_KEY = 'workout-theme';

/** The nullable boolean in the database maps onto the three-state preference. */
export function preferenceFromColumn(darkMode: boolean | null | undefined): ThemePreference {
  if (darkMode === null || darkMode === undefined) return 'system';
  return darkMode ? 'dark' : 'light';
}

export function columnFromPreference(preference: ThemePreference): boolean | null {
  if (preference === 'system') return null;
  return preference === 'dark';
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/**
 * Apply the theme to the document.
 *
 * Tailwind is configured with darkMode: 'class', so a single class on <html>
 * drives every `dark:` variant. The theme-color meta is updated alongside it
 * so the Android status bar matches once the app is installed — an installed
 * PWA showing a light status bar over a dark screen looks broken in a way
 * that is hard to attribute.
 */
export function applyTheme(theme: ResolvedTheme, doc: Document = document): void {
  doc.documentElement.classList.toggle('dark', theme === 'dark');
  doc.documentElement.style.colorScheme = theme;

  const meta = doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#111827' : '#4f46e5');
}

export function systemPrefersDark(win: Window = window): boolean {
  return win.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** Cached so the inline script in index.html can avoid a flash of the wrong theme. */
export function readCachedTheme(): ResolvedTheme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export function cacheTheme(theme: ResolvedTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or a full quota. The theme still applies for this session.
  }
}
