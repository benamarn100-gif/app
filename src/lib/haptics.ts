import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { usePreferences } from '@/state/preferences';

/**
 * Haptik-Vokabular der App (Vorgabe): leicht bei Auswahl, Erfolg bei Buchung,
 * Warnung bei Fehlern. Respektiert die Einstellung „Haptisches Feedback“.
 */
function enabled(): boolean {
  return Platform.OS !== 'web' && usePreferences.getState().haptics;
}

export const haptics = {
  selection() {
    if (enabled()) void Haptics.selectionAsync().catch(() => undefined);
  },
  light() {
    if (enabled())
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  success() {
    if (enabled())
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
  },
  warning() {
    if (enabled())
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => undefined,
      );
  },
};
