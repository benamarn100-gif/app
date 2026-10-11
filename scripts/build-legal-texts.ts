/**
 * Rechtstexte für die App: docs/legal/{datenschutz,nutzungsbedingungen,impressum}.md →
 * src/features/profile/legalTexts.generated.ts (eine Quelle für Webseite und App).
 *
 *   npx tsx scripts/build-legal-texts.ts
 *
 * Ein Test (src/features/__tests__/legal.test.tsx) schlägt fehl, wenn die Datei veraltet ist.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');

export const LEGAL_SOURCES = {
  privacy: 'docs/legal/datenschutz.md',
  terms: 'docs/legal/nutzungsbedingungen.md',
  imprint: 'docs/legal/impressum.md',
} as const;

export const OUTPUT = 'src/features/profile/legalTexts.generated.ts';

export function generateLegalTexts(): string {
  const entries = Object.entries(LEGAL_SOURCES)
    .map(([key, file]) => `  ${key}: ${JSON.stringify(readFileSync(join(ROOT, file), 'utf8'))},`)
    .join('\n');
  return `// GENERIERT von scripts/build-legal-texts.ts aus docs/legal – nicht von Hand ändern.\nexport const LEGAL_TEXTS = {\n${entries}\n} as const;\n`;
}

if (require.main === module) {
  writeFileSync(join(ROOT, OUTPUT), generateLegalTexts());
  console.log(`Rechtstexte → ${OUTPUT}`);
}
