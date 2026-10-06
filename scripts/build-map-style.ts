/**
 * Kartenstile für den eigenen EU-Kachelspeicher (docs/map-tiles.md).
 *
 * Erzeugt style-light.json und style-dark.json für eine PMTiles-Datei, Schriften und Symbole,
 * die alle unter derselben Basis-URL liegen – keine Anfragen an Dritte.
 *
 * Nutzung: npx tsx scripts/build-map-style.ts <basis-url> [ausgabeordner=dist-map] [pmtiles-datei=germany.pmtiles]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { layers, namedFlavor } from '@protomaps/basemaps';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

export const MAP_FLAVORS = ['light', 'dark'] as const;
export type MapFlavor = (typeof MAP_FLAVORS)[number];

/** Schriften, die die Stile verwenden (nur diese müssen hochgeladen werden). */
export const MAP_FONTS = [
  'Noto Sans Regular',
  'Noto Sans Medium',
  'Noto Sans Italic',
  // nur für Ortsnamen in Devanagari-Schrift (Ausdruck in den Protomaps-Ebenen)
  'Noto Sans Devanagari Regular v1',
];

export function buildMapStyle(baseUrl: string, flavorName: MapFlavor, archive = 'germany.pmtiles') {
  const base = baseUrl.replace(/\/+$/, '');
  if (!/^https:\/\//.test(base))
    throw new Error(`Basis-URL muss mit https:// beginnen: ${baseUrl}`);
  // Ohne Geschäfte, Restaurants & Co.: Auf unserer Karte zählen nur die Praxen.
  const { pois: _pois, ...flavor } = namedFlavor(flavorName);
  const style: StyleSpecification = {
    version: 8,
    name: `MedNow ${flavorName}`,
    glyphs: `${base}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${base}/sprites/v4/${flavorName}`,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${base}/${archive}`,
        attribution:
          '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap-Mitwirkende</a> · <a href="https://protomaps.com">Protomaps</a>',
      },
    },
    layers: layers('protomaps', flavor, { lang: 'de' }),
  };
  return style;
}

function main() {
  const [baseUrl, outDir = 'dist-map', archive = 'germany.pmtiles'] = process.argv.slice(2);
  if (!baseUrl) {
    console.error(
      'Nutzung: npx tsx scripts/build-map-style.ts <basis-url> [ausgabeordner] [pmtiles-datei]',
    );
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });
  for (const flavor of MAP_FLAVORS) {
    const file = join(outDir, `style-${flavor}.json`);
    writeFileSync(file, `${JSON.stringify(buildMapStyle(baseUrl, flavor, archive))}\n`);
    console.log(`${file} geschrieben`);
  }
}

if (require.main === module) main();
