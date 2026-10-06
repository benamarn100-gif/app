import { Platform } from 'react-native';
import { createEventInCalendarAsync } from 'expo-calendar/legacy';

import type { Practice } from '@/domain/types';
import type { TFn } from '@/i18n/useT';

/**
 * Kalender-Export über den System-Dialog (keine Leseberechtigung nötig).
 * Neutraler Titel „Arzttermin“ – die Praxis steht nur im Ort-Feld, damit geteilte
 * Kalender keine Fachrichtung verraten. Nutzer können im Dialog alles anpassen.
 */
export async function addAppointmentToCalendar(
  appointment: { startsAt: string; endsAt: string },
  practice: Pick<Practice, 'name' | 'address'>,
  t: TFn,
): Promise<'saved' | 'canceled' | 'unavailable'> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const result = await createEventInCalendarAsync({
      title: t('booking.calendarTitle'),
      startDate: new Date(appointment.startsAt),
      endDate: new Date(appointment.endsAt),
      location: `${practice.name}, ${practice.address.street}, ${practice.address.postalCode} ${practice.address.city}`,
      timeZone: 'Europe/Berlin',
    });
    return result.action === 'saved' || result.action === 'done' ? 'saved' : 'canceled';
  } catch {
    return 'unavailable';
  }
}
