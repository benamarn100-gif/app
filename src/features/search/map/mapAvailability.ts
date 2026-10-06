import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * MapLibre braucht nativen Code → nicht in Expo Go und nicht im Web.
 * Dann zeigt die Suche die gleichwertige Liste (Barrierefreiheit: Liste ist ohnehin Pflicht).
 */
export function isMapAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

/** Zoomstufe, die einen Umkreis (km) ungefähr abdeckt. */
export function zoomForRadius(radiusKm: number): number {
  return Math.max(7, Math.min(16, 14 - Math.log2(Math.max(radiusKm, 0.5) / 1.5)));
}
