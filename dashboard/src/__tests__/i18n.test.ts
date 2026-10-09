// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../i18n';
import { de } from '../i18n/de';
import { en } from '../i18n/en';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out.set(`${prefix}${key}`, value);
    else for (const [k, v] of flatten(value, `${prefix}${key}.`)) out.set(k, v);
  }
  return out;
}

const vars = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('Dashboard-Texte', () => {
  const deFlat = flatten(de);
  const enFlat = flatten(en);

  it('Deutsch und Englisch haben dieselben Schlüssel und keine leeren Texte', () => {
    expect([...enFlat.keys()].sort()).toEqual([...deFlat.keys()].sort());
    for (const [key, value] of [...deFlat, ...enFlat]) expect(value.trim(), key).not.toBe('');
  });

  it('Platzhalter stimmen überein', () => {
    for (const [key, value] of deFlat)
      expect(vars(enFlat.get(key) ?? ''), key).toEqual(vars(value));
  });

  it('Mehrzahl, Marke und gemeinsame App-Texte', () => {
    const t = createTranslator('de');
    expect(t.tp('templates.applied', 1)).toBe('1 neuer Termin angelegt.');
    expect(t.tp('templates.applied', 12)).toBe('12 neue Termine angelegt.');
    expect(t.t('week.bookedWeek')).toBe('Über Terminlücke gebucht');
    expect(t.reason('vaccination')).toBe('Impfung');
    expect(createTranslator('en').tp('freshness.hours', 2)).toBe('Updated 2 hrs ago');
  });

  it('Deutsch spricht Praxen mit „Sie“ an', () => {
    for (const [key, value] of deFlat) expect(value, key).not.toMatch(/\b(du|dich|dein\w*)\b/);
  });
});
