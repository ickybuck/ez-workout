import { describe, it, expect, vi } from 'vitest';
import {
  preferenceFromColumn,
  columnFromPreference,
  resolveTheme,
  applyTheme,
  readCachedTheme,
  cacheTheme,
  THEME_STORAGE_KEY,
  DARK_STYLES_READY,
} from './theme';

describe('mapping the nullable column onto three states', () => {
  it('treats null as following the device', () => {
    // Never having chosen is different from having chosen light.
    expect(preferenceFromColumn(null)).toBe('system');
  });

  it('treats a missing value as following the device too', () => {
    // A row written before the column existed comes back undefined.
    expect(preferenceFromColumn(undefined)).toBe('system');
  });

  it.each([
    [true, 'dark'],
    [false, 'light'],
  ] as const)('maps %s to %s', (column, expected) => {
    expect(preferenceFromColumn(column)).toBe(expected);
  });

  it.each(['system', 'light', 'dark'] as const)('round-trips %s', (preference) => {
    expect(preferenceFromColumn(columnFromPreference(preference))).toBe(preference);
  });
});

describe('resolveTheme', () => {
  it('follows the device when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignores the device when the user has chosen', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('applyTheme', () => {
  const makeDoc = () => {
    const classes = new Set<string>();
    const meta = { content: '', setAttribute: (_: string, v: string) => { meta.content = v; } };
    return {
      documentElement: {
        classList: {
          toggle: (name: string, on: boolean) => {
            if (on) classes.add(name);
            else classes.delete(name);
          },
        },
        style: {} as { colorScheme?: string },
      },
      querySelector: () => meta,
      _classes: classes,
      _meta: meta,
    } as unknown as Document & { _classes: Set<string>; _meta: { content: string } };
  };

  // These assert the CURRENT behaviour, which is that nothing dark is applied
  // to the document while DARK_STYLES_READY is false. Applying a dark
  // color-scheme over components that have no dark styles renders white text
  // on white cards — it shipped that way once and made the timers invisible on
  // any device set to dark mode. When the first dark: styles land, flip the
  // flag and invert these three expectations in the same change.
  it('does not add the dark class while the components have no dark styles', () => {
    const doc = makeDoc();
    applyTheme('dark', doc);
    expect(DARK_STYLES_READY).toBe(false);
    expect(doc._classes.has('dark')).toBe(false);

    applyTheme('light', doc);
    expect(doc._classes.has('dark')).toBe(false);
  });

  it('pins colorScheme to light, which is what keeps default text readable', () => {
    const doc = makeDoc();
    applyTheme('dark', doc);
    // The whole bug in one assertion: colorScheme dark makes every element
    // without an explicit text colour render white.
    expect(doc.documentElement.style.colorScheme).toBe('light');
  });

  it('keeps theme-color light, so the status bar matches the light app', () => {
    const doc = makeDoc();
    applyTheme('dark', doc);
    expect(doc._meta.content).toBe('#4f46e5');

    applyTheme('light', doc);
    expect(doc._meta.content).toBe('#4f46e5');
  });

  it('still resolves and stores the preference, so nothing is lost meanwhile', () => {
    // The preference plumbing stays live and correct; only its application to
    // the document is held back.
    expect(resolveTheme('system', true)).toBe('dark');
    expect(preferenceFromColumn(true)).toBe('dark');
  });
});

describe('cached theme', () => {
  const stubStorage = (initial: Record<string, string> = {}) => {
    const store = { ...initial };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    });
    return store;
  };

  it('round-trips a cached theme', () => {
    stubStorage();
    cacheTheme('dark');
    expect(readCachedTheme()).toBe('dark');
    vi.unstubAllGlobals();
  });

  it('returns null rather than a bad value when storage holds junk', () => {
    // The inline script in index.html trusts this; a junk value must not
    // become a class name on <html>.
    stubStorage({ [THEME_STORAGE_KEY]: 'chartreuse' });
    expect(readCachedTheme()).toBeNull();
    vi.unstubAllGlobals();
  });

  it('does not throw when storage refuses to write', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(() => cacheTheme('dark')).not.toThrow();
    vi.unstubAllGlobals();
  });
});
