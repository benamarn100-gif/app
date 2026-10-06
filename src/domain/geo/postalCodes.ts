import type { LatLng } from '../types';

/**
 * Ungefähre Mittelpunkte der Postleitzahlgebiete der Demo-Städte (offline, ohne Geocoding).
 * Andere PLZ werden über den Geocoder des Geräts aufgelöst (src/lib/location.ts).
 */
export const POSTAL_CENTROIDS: Record<string, LatLng> = {
  // Fulda
  '36037': { lat: 50.556, lng: 9.68 },
  '36039': { lat: 50.585, lng: 9.69 },
  '36041': { lat: 50.54, lng: 9.64 },
  '36043': { lat: 50.535, lng: 9.705 },
  // Kassel
  '34117': { lat: 51.316, lng: 9.493 },
  '34119': { lat: 51.318, lng: 9.47 },
  '34121': { lat: 51.3, lng: 9.48 },
  '34125': { lat: 51.322, lng: 9.515 },
  '34127': { lat: 51.333, lng: 9.495 },
  '34131': { lat: 51.31, lng: 9.44 },
  // Würzburg
  '97070': { lat: 49.794, lng: 9.932 },
  '97072': { lat: 49.785, lng: 9.935 },
  '97074': { lat: 49.785, lng: 9.96 },
  '97080': { lat: 49.81, lng: 9.94 },
  '97082': { lat: 49.79, lng: 9.91 },
};

export const isValidPostalCode = (value: string) => /^(?!00)\d{5}$/.test(value.trim());
