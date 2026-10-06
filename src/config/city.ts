/**
 * Demo-Städte für den Seed. Standard: Fulda.
 * Auswahl über EXPO_PUBLIC_DEMO_CITY (App) bzw. DEMO_CITY (Seed-Skript).
 * Postleitzahlen sind real, Praxen/Adressen im Seed sind fiktiv.
 */
export type CityConfig = {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  postalCodes: readonly string[];
  /** Radius, in dem Demo-Praxen verteilt werden (km). */
  spreadKm: number;
};

export const cities = {
  fulda: {
    id: 'fulda',
    name: 'Fulda',
    center: { lat: 50.5558, lng: 9.6808 },
    postalCodes: ['36037', '36039', '36041', '36043'],
    spreadKm: 7,
  },
  kassel: {
    id: 'kassel',
    name: 'Kassel',
    center: { lat: 51.3127, lng: 9.4797 },
    postalCodes: ['34117', '34119', '34121', '34125', '34127', '34131'],
    spreadKm: 8,
  },
  wuerzburg: {
    id: 'wuerzburg',
    name: 'Würzburg',
    center: { lat: 49.7913, lng: 9.9534 },
    postalCodes: ['97070', '97072', '97074', '97080', '97082'],
    spreadKm: 7,
  },
} as const satisfies Record<string, CityConfig>;

export type CityId = keyof typeof cities;

export function resolveCity(id: string | undefined): CityConfig {
  if (id && id in cities) return cities[id as CityId];
  return cities.fulda;
}
