import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { SELF } from '@/domain/profiles';
import { useActiveProfile } from '@/state/activeProfile';
import { useCheckups } from '@/state/checkups';
import { useFavorites } from '@/state/favorites';
import { usePreferences } from '@/state/preferences';

import { disableCalendarSync } from './calendarSync';

/**
 * Konto löschen: alles, was nur auf dem Gerät liegt, ebenfalls entfernen –
 * Einstellungen, Favoriten, aktives Profil, Vorsorge-Erinnerungen, Kalender „MedNow“
 * und alle geplanten lokalen Mitteilungen.
 */
export async function clearLocalData(): Promise<void> {
  usePreferences.getState().reset();
  useFavorites.getState().clear();
  useActiveProfile.getState().setActiveProfile(SELF);
  useCheckups.getState().clear();
  await disableCalendarSync();
  if (Platform.OS !== 'web') {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  }
}
