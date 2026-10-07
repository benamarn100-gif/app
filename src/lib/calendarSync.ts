import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar/legacy';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { colors } from '@/design/tokens';
import type { Appointment, Practice } from '@/domain/types';
import type { TFn } from '@/i18n/useT';

import { preferenceStorage } from './storage';

/**
 * Kalender-Sync (Feature 4): Termine landen automatisch in einem eigenen Kalender „MedNow“
 * auf dem Gerät und werden bei Verschieben/Storno aktualisiert bzw. gelöscht.
 * Nutzen: Der Kalender stimmt immer – ohne jedes Mal „Zum Kalender hinzufügen“ zu tippen.
 *
 * Datenschutz: nur auf dem Gerät, neutraler Titel „Arzttermin“, Praxis nur im Ort-Feld.
 * Gespeichert wird lokal nur die Zuordnung Termin-ID → Kalendereintrag-ID.
 * Ausschalten löscht den Kalender „MedNow“ samt aller Einträge.
 * iOS braucht dafür vollen Kalenderzugriff (Abfrage erst beim Einschalten).
 */
type SyncState = {
  enabled: boolean;
  calendarId: string | null;
  events: Record<string, string>;
};

export const useCalendarSync = create<SyncState>()(
  persist(() => ({ enabled: false, calendarId: null, events: {} }) as SyncState, {
    name: 'mednow.calendarSync.v1',
    storage: preferenceStorage,
    version: 1,
  }),
);

const CALENDAR_TITLE = 'MedNow';

export type EnableResult = 'enabled' | 'denied' | 'unavailable';

export async function enableCalendarSync(): Promise<EnableResult> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return 'denied';
    const calendarId = await ensureCalendar();
    useCalendarSync.setState({ enabled: true, calendarId });
    return 'enabled';
  } catch {
    return 'unavailable';
  }
}

/** Schaltet aus und entfernt den Kalender „MedNow“ mit allen Einträgen. */
export async function disableCalendarSync(): Promise<void> {
  const { calendarId } = useCalendarSync.getState();
  useCalendarSync.setState({ enabled: false, calendarId: null, events: {} });
  if (!calendarId || Platform.OS === 'web') return;
  await Calendar.deleteCalendarAsync(calendarId).catch(() => undefined);
}

export async function syncAppointmentToCalendar(
  appointment: Pick<Appointment, 'id' | 'startsAt' | 'endsAt'>,
  practice: Pick<Practice, 'name' | 'address'>,
  t: TFn,
): Promise<void> {
  const state = useCalendarSync.getState();
  if (!state.enabled || Platform.OS === 'web') return;
  try {
    const calendarId = state.calendarId ?? (await ensureCalendar());
    const details = {
      title: t('booking.calendarTitle'),
      startDate: new Date(appointment.startsAt),
      endDate: new Date(appointment.endsAt),
      location: `${practice.name}, ${practice.address.street}, ${practice.address.postalCode} ${practice.address.city}`,
      timeZone: 'Europe/Berlin',
    };
    const existing = state.events[appointment.id];
    if (existing) {
      await Calendar.updateEventAsync(existing, details);
      return;
    }
    const eventId = await Calendar.createEventAsync(calendarId, details);
    useCalendarSync.setState((s) => ({
      calendarId,
      events: { ...s.events, [appointment.id]: eventId },
    }));
  } catch {
    // Kalender gelöscht oder Zugriff entzogen: still bleiben, Termin selbst ist gebucht
  }
}

export async function removeAppointmentFromCalendar(appointmentId: string): Promise<void> {
  const eventId = useCalendarSync.getState().events[appointmentId];
  if (!eventId || Platform.OS === 'web') return;
  useCalendarSync.setState((s) => {
    const { [appointmentId]: _removed, ...events } = s.events;
    return { events };
  });
  await Calendar.deleteEventAsync(eventId).catch(() => undefined);
}

async function ensureCalendar(): Promise<string> {
  const stored = useCalendarSync.getState().calendarId;
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const found =
    calendars.find((c) => c.id === stored) ?? calendars.find((c) => c.title === CALENDAR_TITLE);
  if (found) return found.id;
  if (Platform.OS === 'ios') {
    const fallback = await Calendar.getDefaultCalendarAsync();
    return Calendar.createCalendarAsync({
      title: CALENDAR_TITLE,
      color: colors.light.primary,
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: fallback.source.id,
      source: fallback.source,
      name: CALENDAR_TITLE,
      ownerAccount: 'personal',
    });
  }
  return Calendar.createCalendarAsync({
    title: CALENDAR_TITLE,
    color: colors.light.primary,
    entityType: Calendar.EntityTypes.EVENT,
    source: { isLocalAccount: true, name: CALENDAR_TITLE, type: 'LOCAL' },
    name: CALENDAR_TITLE,
    ownerAccount: CALENDAR_TITLE,
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}
