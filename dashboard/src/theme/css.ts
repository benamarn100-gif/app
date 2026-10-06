/**
 * Erzeugt CSS-Variablen aus den gemeinsamen Design-Tokens (src/design/tokens.ts).
 * Das Dashboard nutzt ausschließlich diese Variablen – keine Farbwerte im CSS.
 * Relativer Import, weil auch vite.config.ts diese Datei lädt (ohne Alias-Auflösung).
 */
import {
  colors,
  fontFamily,
  layout,
  motion,
  radius,
  shadows,
  space,
  typography,
  type ColorScheme,
} from '../../../src/design/tokens';

const FONT_STACKS: Record<string, { family: string; weight: number }> = {
  [fontFamily.headingSemiBold]: { family: '"Plus Jakarta Sans"', weight: 600 },
  [fontFamily.headingBold]: { family: '"Plus Jakarta Sans"', weight: 700 },
  [fontFamily.body]: { family: 'Inter', weight: 400 },
  [fontFamily.bodyMedium]: { family: 'Inter', weight: 500 },
};
const FALLBACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function declarations(entries: [string, string | number][]): string {
  return entries.map(([k, v]) => `  ${k}: ${v};`).join('\n');
}

export function schemeVars(scheme: ColorScheme): [string, string][] {
  return [
    ...Object.entries(colors[scheme]).map(
      ([k, v]) => [`--color-${kebab(k)}`, v] as [string, string],
    ),
    ...Object.entries(shadows[scheme]).map(([k, v]) => [`--shadow-${k}`, v] as [string, string]),
  ];
}

export function staticVars(): [string, string][] {
  const vars: [string, string][] = [
    ...Object.entries(space).map(([k, v]) => [`--space-${k}`, `${v}px`] as [string, string]),
    ...Object.entries(radius).map(([k, v]) => [`--radius-${k}`, `${v}px`] as [string, string]),
    ['--touch-target', `${layout.touchTarget}px`],
    ['--icon-sm', `${layout.iconSize.sm}px`],
    ['--icon-md', `${layout.iconSize.md}px`],
    ['--icon-lg', `${layout.iconSize.lg}px`],
    ['--motion-fast', `${motion.duration.fast}ms`],
    ['--motion-base', `${motion.duration.base}ms`],
    ['--motion-slow', `${motion.duration.slow}ms`],
    ['--press-scale', String(motion.pressScale)],
  ];
  for (const [variant, t] of Object.entries(typography)) {
    const font = FONT_STACKS[t.fontFamily];
    if (!font) throw new Error(`Unbekannte Schrift im Token ${variant}: ${t.fontFamily}`);
    const name = kebab(variant);
    vars.push(
      [`--type-${name}-family`, `${font.family}, ${FALLBACK}`],
      [`--type-${name}-weight`, String(font.weight)],
      [`--type-${name}-size`, `${t.fontSize}px`],
      [`--type-${name}-line`, `${t.lineHeight}px`],
      [`--type-${name}-tracking`, `${t.letterSpacing ?? 0}px`],
    );
  }
  return vars;
}

/** Vollständiges Theme: helle Werte als Standard, dunkle per prefers-color-scheme. */
export function themeCss(): string {
  return [
    `:root {\n  color-scheme: light dark;\n${declarations(staticVars())}\n${declarations(schemeVars('light'))}\n}`,
    `@media (prefers-color-scheme: dark) {\n:root {\n${declarations(schemeVars('dark'))}\n}\n}`,
  ].join('\n');
}
