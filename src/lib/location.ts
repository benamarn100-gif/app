import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { roundLocation } from '@/domain/geo/distance';
import { isValidPostalCode, POSTAL_CENTROIDS } from '@/domain/geo/postalCodes';
import type { LatLng } from '@/domain/types';

/**
 * Standort nur „bei Nutzung“ und nur so genau wie nötig (~110 m), kein Hintergrund-
 * Tracking. Die Koordinaten leben nur im Arbeitsspeicher dieser Sitzung.
 */
type DeviceLocationState = {
  coords: LatLng | null;
  status: 'idle' | 'locating' | 'ready' | 'denied' | 'error';
};

export const useDeviceLocation = create<DeviceLocationState>(() => ({
  coords: null,
  status: 'idle',
}));

export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Fragt (falls nötig) die Erlaubnis an und ermittelt den ungefähren Standort. */
export async function locateDevice(options: { ask: boolean }): Promise<LatLng | null> {
  useDeviceLocation.setState({ status: 'locating' });
  try {
    const permission = options.ask
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      useDeviceLocation.setState({ status: 'denied', coords: null });
      return null;
    }
    const last =
      Platform.OS === 'web'
        ? null
        : await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000, requiredAccuracy: 500 });
    const position =
      last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const coords = roundLocation(
      { lat: position.coords.latitude, lng: position.coords.longitude },
      3,
    );
    useDeviceLocation.setState({ status: 'ready', coords });
    return coords;
  } catch {
    useDeviceLocation.setState({ status: 'error', coords: null });
    return null;
  }
}

/** PLZ → ungefährer Mittelpunkt (offline für Demo-Städte, sonst Geocoder des Geräts). */
export async function resolvePostalCode(code: string): Promise<LatLng | null> {
  const plz = code.trim();
  if (!isValidPostalCode(plz)) return null;
  const known = POSTAL_CENTROIDS[plz];
  if (known) return known;
  if (Platform.OS === 'web') return null;
  try {
    const results = await Location.geocodeAsync(`${plz}, Deutschland`);
    const hit = results[0];
    return hit ? roundLocation({ lat: hit.latitude, lng: hit.longitude }, 2) : null;
  } catch {
    return null;
  }
}
