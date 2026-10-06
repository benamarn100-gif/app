import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';

import { buildMapStyle, MAP_FLAVORS, MAP_FONTS } from '../build-map-style';

describe('Kartenstile für den eigenen Kachelspeicher', () => {
  it.each(MAP_FLAVORS)('%s ist gültig und lädt nur von der eigenen Adresse', (flavor) => {
    const style = buildMapStyle('https://karten.example.de/', flavor);
    expect(validateStyleMin(style)).toEqual([]);

    const urls = [style.glyphs, style.sprite, (style.sources.protomaps as { url: string }).url];
    for (const url of urls)
      expect(String(url)).toMatch(/^(pmtiles:\/\/)?https:\/\/karten\.example\.de\//);
  });

  it('nutzt nur die hochgeladenen Schriften und keine POI-Ebene', () => {
    const style = buildMapStyle('https://karten.example.de', 'light');
    const stacks = JSON.stringify(style.layers).match(/"Noto Sans[^"]*"/g) ?? [];
    const fonts = new Set(stacks.map((f) => JSON.parse(f) as string));
    expect([...fonts].filter((f) => !MAP_FONTS.includes(f))).toEqual([]);
    expect(style.layers.map((l) => l.id)).not.toContain('pois');
  });

  it('verlangt HTTPS', () => {
    expect(() => buildMapStyle('http://karten.example.de', 'light')).toThrow(/https/);
  });
});
