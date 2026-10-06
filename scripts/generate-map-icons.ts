/**
 * Erzeugt die Karten-Pins (Status-Farbe + Symbol) als PNG aus SVG.
 * Status nie nur über Farbe: jeder Pin trägt ein eigenes Symbol (✓ ! × ?).
 * Aufruf: npx tsx scripts/generate-map-icons.ts
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

import { colors } from '../src/design/tokens';

const GLYPHS: Record<string, string> = {
  free: '<path d="M21 33 L29 41 L43 25" stroke="#FFFFFF" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  few: '<path d="M32 21 L32 35" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="43" r="3.6" fill="#FFFFFF"/>',
  booked:
    '<path d="M24 24 L40 40 M40 24 L24 40" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>',
  unknown:
    '<path d="M25.5 26.5 C25.5 22 28.5 19.5 32.5 19.5 C36.5 19.5 39.5 22 39.5 25.8 C39.5 31 33 31 33 36" stroke="#FFFFFF" stroke-width="5.5" fill="none" stroke-linecap="round"/><circle cx="33" cy="44" r="3.4" fill="#FFFFFF"/>',
};

async function main() {
  const out = join(__dirname, '..', 'assets', 'map');
  mkdirSync(out, { recursive: true });
  for (const scheme of ['light', 'dark'] as const) {
    const c = colors[scheme];
    const fill: Record<string, string> = {
      free: colors.light.statusFree,
      few: colors.light.statusFew,
      booked: colors.light.statusBooked,
      unknown: colors.light.statusUnknown,
    };
    for (const [status, glyph] of Object.entries(GLYPHS)) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="30" fill="${c.mapPinHalo}"/>
        <circle cx="32" cy="32" r="25" fill="${fill[status]}"/>
        ${glyph}
      </svg>`;
      await sharp(Buffer.from(svg))
        .png()
        .toFile(join(out, `pin-${status}-${scheme}.png`));
    }
  }
  console.log('Karten-Pins erzeugt in assets/map/');
}

void main();
