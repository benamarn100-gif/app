import { Linking, Platform } from 'react-native';

import type { TravelMode } from '@/domain/geo/travel';
import type { Practice } from '@/domain/types';

/** Apple Karten: d = Auto, w = zu Fuß, r = ÖPNV */
const APPLE_FLAG: Record<TravelMode, string> = { car: 'd', walk: 'w', transit: 'r' };
const GOOGLE_MODE: Record<TravelMode, string> = {
  car: 'driving',
  walk: 'walking',
  transit: 'transit',
};
const OSM_ENGINE: Partial<Record<TravelMode, string>> = {
  car: 'fossgis_osrm_car',
  walk: 'fossgis_osrm_foot',
};

/**
 * Route in der Karten-App des Systems öffnen (Apple Karten, Google Maps, sonst OSM im Browser).
 * Mit `mode` startet die Karten-App direkt im passenden Verkehrsmittel (Feature 3); der Start
 * ist immer der aktuelle Standort im Gerät – die App selbst kennt und sendet ihn nicht.
 */
export async function openRoute(
  practice: Pick<Practice, 'name' | 'location' | 'address'>,
  mode?: TravelMode,
) {
  for (const url of routeUrls(practice, mode, Platform.OS)) {
    try {
      if (Platform.OS === 'web' || (await Linking.canOpenURL(url))) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // nächste Variante versuchen
    }
  }
}

export function routeUrls(
  practice: Pick<Practice, 'name' | 'location'>,
  mode: TravelMode | undefined,
  os: typeof Platform.OS,
): string[] {
  const { lat, lng } = practice.location;
  const label = encodeURIComponent(practice.name);
  const to = `${lat},${lng}`;
  const osm = (engine?: string) =>
    `https://www.openstreetmap.org/directions?${engine ? `engine=${engine}&` : ''}to=${lat}%2C${lng}`;
  const google = (m: TravelMode) =>
    `https://www.google.com/maps/dir/?api=1&destination=${to}&travelmode=${GOOGLE_MODE[m]}`;

  if (os === 'ios') {
    const flag = mode ? `&dirflg=${APPLE_FLAG[mode]}` : '';
    return [`maps://?daddr=${to}&q=${label}${flag}`, `https://maps.apple.com/?daddr=${to}${flag}`];
  }
  if (os === 'android') {
    // Ohne Verkehrsmittel: Auswahl der Karten-App (geo:), mit: Google Maps (falls installiert)
    return mode
      ? [google(mode), `geo:0,0?q=${to}(${label})`]
      : [`geo:0,0?q=${to}(${label})`, osm()];
  }
  // Web: OpenStreetMap; ÖPNV kann OSM nicht – dann Google Maps
  if (mode === 'transit') return [google('transit')];
  return [osm(mode ? OSM_ENGINE[mode] : undefined)];
}

export function callPhone(phone: string) {
  void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
}
