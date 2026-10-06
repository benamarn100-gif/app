/**
 * Prüft die Übersetzungen:
 *  1. Deutsch und Englisch haben dieselben Schlüssel (ohne _formal-Varianten).
 *  2. Jeder deutsche Text mit du-Ansprache hat eine Sie-Variante (<key>_formal).
 *  3. Jede _formal-Variante hat einen Basisschlüssel.
 *  4. Keine leeren Texte.
 *  5. Alle im Code statisch genutzten Schlüssel (t('…')) existieren.
 * Exit-Code 1 bei Fehlern (läuft in CI).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import de from '../src/i18n/locales/de.json';
import en from '../src/i18n/locales/en.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const stripPlural = (k: string) => k.replace(/_(one|other)$/, '');
const base = (k: string) => stripPlural(k).replace(/_formal$/, '');

/** Texte, die die Anredeform selbst benennen (Umschalter „Du / Sie“). */
const ALLOW_DU = new Set(['profile.addressInformal']);

const DU = /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|deines)\b/i;

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(ts|tsx)$/.test(name)) files.push(path);
  }
  return files;
}

export function checkI18n(): string[] {
  const errors: string[] = [];
  const fde = flatten(de as Tree);
  const fen = flatten(en as Tree);

  const deKeys = new Set(Object.keys(fde).filter((k) => !/_formal(_one|_other)?$/.test(k)));
  const enKeys = new Set(Object.keys(fen));
  for (const k of deKeys) if (!enKeys.has(k)) errors.push(`Englisch fehlt: ${k}`);
  for (const k of enKeys) if (!deKeys.has(k)) errors.push(`Deutsch fehlt: ${k}`);

  for (const [k, v] of Object.entries(fde)) {
    if (!v.trim()) errors.push(`Leerer Text (de): ${k}`);
    if (/_formal/.test(k)) {
      const baseKey = k.replace('_formal', '');
      if (!(baseKey in fde)) errors.push(`_formal ohne Basis: ${k}`);
      if (DU.test(v)) errors.push(`Sie-Variante enthält du-Form: ${k}`);
      continue;
    }
    if (DU.test(v) && !ALLOW_DU.has(k)) {
      const formal = stripPlural(k) + '_formal' + (k.match(/_(one|other)$/)?.[0] ?? '');
      if (!(formal in fde)) errors.push(`du-Text ohne Sie-Variante: ${k} → ${formal}`);
    }
  }
  for (const [k, v] of Object.entries(fen)) if (!v.trim()) errors.push(`Leerer Text (en): ${k}`);

  const known = new Set(Object.keys(fde).map(base));
  const root = join(__dirname, '..', 'src');
  for (const file of walk(root)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) {
      const key = match[1]!;
      if (!known.has(key))
        errors.push(`Unbekannter Schlüssel ${key} in ${file.replace(root, 'src')}`);
    }
  }
  return errors;
}

if (require.main === module) {
  const errors = checkI18n();
  for (const e of errors) console.log(`✗ ${e}`);
  console.log(
    errors.length
      ? `\n${errors.length} i18n-Fehler.`
      : 'i18n: alle Schlüssel vollständig (de/en, du/Sie).',
  );
  if (errors.length) process.exit(1);
}
