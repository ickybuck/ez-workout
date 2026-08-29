import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  applyTheme,
  cacheTheme,
  columnFromPreference,
  preferenceFromColumn,
  resolveTheme,
  systemPrefersDark,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/theme';

interface ThemeContextValue {
  /** What the user chose: system, light or dark. */
  preference: ThemePreference;
  /** What that currently resolves to. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  theme: 'light',
  setPreference: () => {},
});

export const useTheme = () => useContext(ThemeContext);

/**
 * Owns the active theme.
 *
 * Deliberately applies the theme before waiting on the network. The stored
 * preference lives in user_settings, but reading it takes a round trip, and
 * an app that starts light and lurches dark a second later is worse than one
 * that starts on the device preference and stays there. The cached value from
 * the previous session covers the gap; the database read only corrects it if
 * the user has actually chosen otherwise.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [prefersDark, setPrefersDark] = useState(() => systemPrefersDark());

  const theme = resolveTheme(preference, prefersDark);

  // Follow the device live, so a phone switching at sunset takes the app with
  // it — but only while the preference is 'system'.
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;

    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    cacheTheme(theme);
  }, [theme]);

  // Load the stored preference once signed in.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    supabase
      .from('user_settings')
      .select('dark_mode')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setPreferenceState(preferenceFromColumn(data?.dark_mode));
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      // Apply immediately, persist in the background. A theme toggle that
      // waits on a round trip feels broken even when it works.
      setPreferenceState(next);
      if (!user) return;

      void supabase
        .from('user_settings')
        .update({ dark_mode: columnFromPreference(next) })
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) console.error('Could not save theme preference:', error);
        });
    },
    [user],
  );

  return (
    <ThemeContext.Provider value={{ preference, theme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
};
