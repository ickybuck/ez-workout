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

/**
 * Whether the components have dark styles yet. They do not.
 *
 * This exists because shipping the plumbing without it caused a real outage of
 * legibility. `color-scheme: dark` changes the browser's DEFAULT text colour to
 * white for every element that does not set one explicitly. Since not one
 * component carries a `dark:` class, every background stayed light — so on any
 * device set to dark mode the app rendered white text on white cards. The
 * workout and rest timers vanished entirely, because they are bare divs with no
 * `text-*` class to save them.
 *
 * The original note on this work said "half-applying it would be worse than
 * not: dark page, white cards". That was right, and then it shipped anyway,
 * because it was only ever checked in a light-mode browser. A device
 * preference is not a thing you notice by reading code.
 *
 * So the resolution logic stays live and tested — the preference is still read,
 * stored and followed — but nothing that changes rendering is applied until the
 * components can survive it. Flip this to true in the same change that lands
 * the first `dark:` styles, not before.
 */
export const DARK_STYLES_READY = false;

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
  // Until the components have dark styles, everything that would actually
  // change rendering is pinned to light. Applying only the parts that are
  // ready produces a worse result than applying none of them: a dark
  // color-scheme over light components means white text on white cards.
  const effective: ResolvedTheme = DARK_STYLES_READY ? theme : 'light';

  doc.documentElement.classList.toggle('dark', effective === 'dark');
  doc.documentElement.style.colorScheme = effective;

  const meta = doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', effective === 'dark' ? '#111827' : '#4f46e5');
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
