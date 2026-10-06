// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { colors } from '@app/design/tokens';

import { kebab, themeCss } from '../theme/css';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('Theme aus Design-Tokens', () => {
  it('enthält alle Farb-Tokens für hell und dunkel', () => {
    const css = themeCss();
    for (const scheme of ['light', 'dark'] as const) {
      for (const [name, value] of Object.entries(colors[scheme])) {
        expect(css).toContain(`--color-${kebab(name)}: ${value};`);
      }
    }
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain(':root:not([data-theme="light"])');
  });

  it('styles.css nutzt keine Farbwerte, nur Variablen', () => {
    const withoutComments = styles.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(withoutComments).not.toMatch(/\b(rgba?|hsla?)\(/);
  });

  it('jede verwendete Variable ist im Theme definiert', () => {
    const defined = new Set([...themeCss().matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]));
    const used = new Set([...styles.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]));
    const missing = [...used].filter((name) => !defined.has(name));
    expect(missing).toEqual([]);
  });
});
