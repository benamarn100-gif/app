import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateLegalTexts, OUTPUT } from '../build-legal-texts';

it('Rechtstexte der App entsprechen docs/legal (sonst: npx tsx scripts/build-legal-texts.ts)', () => {
  expect(readFileSync(join(__dirname, '..', '..', OUTPUT), 'utf8')).toBe(generateLegalTexts());
});
