import { Linking, Platform } from 'react-native';

import type { Practice } from '@/domain/types';

/** Route in der Karten-App des Systems öffnen (Apple Karten, Google Maps, sonst OSM im Browser). */
export async function openRoute(practice: Pick<Practice, 'name' | 'location' | 'address'>) {
  const { lat, lng } = practice.location;
  const label = encodeURIComponent(practice.name);
  const urls =
    Platform.OS === 'ios'
      ? [`maps://?daddr=${lat},${lng}&q=${label}`, `https://maps.apple.com/?daddr=${lat},${lng}`]
      : Platform.OS === 'android'
        ? [
            `geo:0,0?q=${lat},${lng}(${label})`,
            `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`,
          ]
        : [`https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`];
  for (const url of urls) {
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

export function callPhone(phone: string) {
  void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
}
