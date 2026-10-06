/**
 * Prüft alle in src/design/tokens.ts deklarierten Farbpaare gegen WCAG 2.1 AA:
 * Text 4,5:1 (1.4.3), UI-Elemente/Grafiken 3:1 (1.4.11) – für hell und dunkel.
 * Exit-Code 1 bei mindestens einem Verstoß (läuft in CI).
 *
 * Aufruf: npm run check:contrast [-- --verbose]
 */
import { colors, contrastPairs, type ColorScheme } from '../src/design/tokens';

const THRESHOLD = { text: 4.5, ui: 3 } as const;

export function parseColor(value: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const h = hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  throw new Error(`Unbekanntes Farbformat: ${value}`);
}

export function relativeLuminance(value: string): number {
  const [r, g, b] = parseColor(value).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type ContrastResult = {
  scheme: ColorScheme;
  fg: string;
  bg: string;
  ratio: number;
  required: number;
  ok: boolean;
  usage: string;
};

export function checkAll(): ContrastResult[] {
  const results: ContrastResult[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    const palette = colors[scheme];
    for (const pair of contrastPairs) {
      const ratio = contrastRatio(palette[pair.fg], palette[pair.bg]);
      const required = THRESHOLD[pair.kind];
      results.push({
        scheme,
        fg: pair.fg,
        bg: pair.bg,
        ratio,
        required,
        ok: ratio >= required,
        usage: pair.usage,
      });
    }
  }
  return results;
}

function main() {
  const verbose = process.argv.includes('--verbose');
  const results = checkAll();
  const failures = results.filter((r) => !r.ok);
  for (const r of verbose ? results : failures) {
    const mark = r.ok ? '✓' : '✗';
    console.log(
      `${mark} [${r.scheme}] ${r.fg} auf ${r.bg}: ${r.ratio.toFixed(2)}:1 (min. ${r.required}:1) – ${r.usage}`,
    );
  }
  console.log(
    `\nKontrastprüfung: ${results.length - failures.length}/${results.length} Paare bestehen WCAG 2.1 AA.`,
  );
  if (failures.length > 0) process.exit(1);
}

if (require.main === module) main();
