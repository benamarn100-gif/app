import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatBerlinTime } from '@/domain/time/berlin';
import type { Appointment } from '@/domain/types';
import type { TFn } from '@/i18n/useT';

/**
 * Benachrichtigungen:
 *  - Erinnerungen 24 h / 2 h vorher als LOKALE Benachrichtigungen (kein Server-Push nötig).
 *  - Push nur für die Warteliste; Erlaubnis erst im Moment des Nutzens.
 * Texte sind datensparsam: keine Praxis, kein Arzt, keine Fachrichtung (Sperrbildschirm).
 */
export const CHANNEL_REMINDERS = 'appointments';
export const CHANNEL_OFFERS = 'offers';

export async function configureNotifications(t: TFn) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
      name: t('notifications.channelName'),
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_OFFERS, {
      name: t('waitlist.title'),
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

const reminderIds = (appointmentId: string) => [
  `reminder-${appointmentId}-24h`,
  `reminder-${appointmentId}-2h`,
];

export async function scheduleReminders(
  appointment: Pick<Appointment, 'id' | 'startsAt'>,
  t: TFn,
  locale: string,
) {
  if (Platform.OS === 'web') return;
  await cancelReminders(appointment.id);
  const start = Date.parse(appointment.startsAt);
  const time = formatBerlinTime(appointment.startsAt, locale);
  const entries = [
    {
      id: reminderIds(appointment.id)[0]!,
      at: start - 24 * 3600_000,
      body: t('notifications.reminder24h', { time }),
    },
    {
      id: reminderIds(appointment.id)[1]!,
      at: start - 2 * 3600_000,
      body: t('notifications.reminder2h', { time }),
    },
  ];
  for (const entry of entries) {
    if (entry.at <= Date.now() + 60_000) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: entry.id,
      content: {
        title: t('notifications.reminderTitle'),
        body: entry.body,
        data: { url: 'mednow://appointments' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(entry.at),
        channelId: CHANNEL_REMINDERS,
      },
    });
  }
}

export async function cancelReminders(appointmentId: string) {
  if (Platform.OS === 'web') return;
  for (const id of reminderIds(appointmentId)) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  }
}

/** Demo-Modus: simulierte Push-Nachricht als lokale Benachrichtigung. */
export async function presentOfferNotification(offerId: string, t: TFn) {
  if (Platform.OS === 'web') return;
  if ((await notificationPermission()) !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notifications.offerTitle'),
      body: t('notifications.offerBody'),
      data: { url: `mednow://offer/${offerId}`, offerId },
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_OFFERS } : null,
  });
}

/** Expo-Push-Token (nur echte Geräte, braucht EAS-Projekt-ID). */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}
