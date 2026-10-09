/**
 * App-Symbole aus einer Quelle (Kalenderblatt mit Haken + Signalpunkt „frei geworden“), ohne Schriftzug –
 * übersteht eine Umbenennung. Farben aus src/design/tokens.ts.
 *
 *   CHROMIUM_PATH=/pfad/zu/chrome npx tsx scripts/generate-app-icons.ts
 *
 * Schreibt: assets/icon.png (1024, ohne Transparenz), android-icon-{foreground,background,monochrome}.png
 * (512), splash-icon.png (1024), favicon.png (48), notification-icon.png (96, weiß auf transparent)
 * und assets/brand/symbol.svg (Quelle für Designer).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { colors } from '../src/design/tokens';

const TEAL = colors.light.primary;
const TEAL_SOFT = colors.light.primarySoft;
const CORAL = colors.light.accent;
const ASSETS = join(__dirname, '..', 'assets');

/** Kalenderblatt auf einer 1024er-Fläche, Mitte ≈ (530, 506), Ausdehnung ≈ 55 % */
const glyph = (mono = false) => {
  const fg = mono ? '#fff' : '#fff';
  const check = mono ? '#000' : TEAL;
  const header = mono ? '#fff' : TEAL_SOFT;
  const gap = mono ? '#000' : TEAL;
  return `
  <clipPath id="body"><rect x="272" y="318" width="480" height="432" rx="84"/></clipPath>
  <g mask="${mono ? 'url(#cut)' : ''}">
    <rect x="272" y="318" width="480" height="432" rx="84" fill="${fg}"/>
    <rect x="272" y="318" width="480" height="124" fill="${header}" clip-path="url(#body)"/>
    <rect x="372" y="250" width="56" height="132" rx="28" fill="${fg}" stroke="${gap}" stroke-width="18"/>
    <rect x="596" y="250" width="56" height="132" rx="28" fill="${fg}" stroke="${gap}" stroke-width="18"/>
    <path d="M404 596 L488 676 L640 520" fill="none" stroke="${check}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="742" cy="330" r="92" fill="${gap}"/>
    <circle cx="742" cy="330" r="70" fill="${mono ? '#fff' : CORAL}"/>
  </g>`;
};

/** Monochrom: alles Weiße bleibt, Haken und Abstände werden ausgeschnitten */
const monoSvg = () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs><mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
    <rect width="1024" height="1024" fill="#000"/>${glyph(true).replace('mask="url(#cut)"', '')}
  </mask></defs>
  <rect width="1024" height="1024" fill="#fff" mask="url(#cut)"/>
</svg>`;

export const SVG = {
  /** iOS/Store: vollflächig (Rundung macht das System) */
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${TEAL}"/>${glyph()}</svg>`,
  foreground: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${glyph()}</svg>`,
  background: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${TEAL}"/></svg>`,
  /** Startbildschirm/Favicon: abgerundete Kachel – passt auf hellen und dunklen Hintergrund */
  tile: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="232" fill="${TEAL}"/>${glyph()}</svg>`,
  mono: monoSvg(),
};

const OUTPUTS: { file: string; svg: keyof typeof SVG; size: number; opaque?: boolean }[] = [
  { file: 'icon.png', svg: 'icon', size: 1024, opaque: true },
  { file: 'android-icon-foreground.png', svg: 'foreground', size: 512 },
  { file: 'android-icon-background.png', svg: 'background', size: 512, opaque: true },
  { file: 'android-icon-monochrome.png', svg: 'mono', size: 512 },
  { file: 'splash-icon.png', svg: 'tile', size: 1024 },
  { file: 'favicon.png', svg: 'tile', size: 48 },
  { file: 'notification-icon.png', svg: 'mono', size: 96 },
];

async function main() {
  mkdirSync(join(ASSETS, 'brand'), { recursive: true });
  writeFileSync(join(ASSETS, 'brand', 'symbol.svg'), SVG.tile.trim() + '\n');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    for (const o of OUTPUTS) {
      const page = await browser.newPage({ viewport: { width: o.size, height: o.size } });
      await page.setContent(
        `<html><body style="margin:0;background:transparent">${SVG[o.svg].replace('<svg ', `<svg width="${o.size}" height="${o.size}" `)}</body></html>`,
      );
      await page.screenshot({ path: join(ASSETS, o.file), omitBackground: !o.opaque });
      await page.close();
      console.log(`${o.file} (${o.size}×${o.size})`);
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
