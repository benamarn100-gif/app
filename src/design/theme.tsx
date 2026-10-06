import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import {
  colors,
  layout,
  motion,
  radius,
  shadows,
  space,
  typography,
  type ColorScheme,
  type ColorTokens,
} from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

export type Theme = {
  scheme: ColorScheme;
  colors: ColorTokens;
  space: typeof space;
  radius: typeof radius;
  typography: typeof typography;
  shadows: (typeof shadows)[ColorScheme];
  motion: typeof motion;
  layout: typeof layout;
};

export function createTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: colors[scheme],
    space,
    radius,
    typography,
    shadows: shadows[scheme],
    motion,
    layout,
  };
}

const themes: Record<ColorScheme, Theme> = {
  light: createTheme('light'),
  dark: createTheme('dark'),
};

const ThemeContext = createContext<Theme>(themes.light);

export function resolveScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): ColorScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({
  preference = 'system',
  children,
}: {
  preference?: ThemePreference;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const scheme = resolveScheme(preference, system);
  return <ThemeContext.Provider value={themes[scheme]}>{children}</ThemeContext.Provider>;
}

/** Erzwingt ein Schema für einen Teilbaum (z. B. Showcase hell/dunkel nebeneinander). */
export function FixedThemeProvider({
  scheme,
  children,
}: {
  scheme: ColorScheme;
  children: ReactNode;
}) {
  return <ThemeContext.Provider value={themes[scheme]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Themenabhängige Styles: `const useStyles = makeStyles((t) => ({ root: {...} }))`.
 * Styles werden pro Theme genau einmal erzeugt.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T) {
  const cache = new WeakMap<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => {
      const cached = cache.get(theme);
      if (cached) return cached;
      const created = StyleSheet.create(factory(theme));
      cache.set(theme, created);
      return created;
    }, [theme]);
  };
}
