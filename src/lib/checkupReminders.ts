import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { TFn } from '@/i18n/useT';

import { CHANNEL_REMINDERS } from './notifications';

const notificationId = (key: string) => `checkup-${key.replace(/[^a-zA-Z0-9-]/g, '-')}`;

/**
 * Lokale Mitteilung zur Vorsorge (Feature 7). Neutraler Text ohne Untersuchung und Person –
 * auf dem Sperrbildschirm soll niemand lesen, worum es geht.
 */
export async function scheduleCheckupReminder(key: string, dueAt: Date, t: TFn): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelCheckupReminder(key);
  if (dueAt.getTime() <= Date.now() + 60_000) return;
  await Notifications.scheduleNotificationAsync({
    identifier: notificationId(key),
    content: {
      title: t('checkups.notificationTitle'),
      body: t('checkups.notificationBody'),
      data: { url: 'terminluecke://checkups' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: dueAt,
      channelId: CHANNEL_REMINDERS,
    },
  });
}

export async function cancelCheckupReminder(key: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(notificationId(key)).catch(() => undefined);
}
