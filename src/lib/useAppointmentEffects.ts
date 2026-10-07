import { useMemo } from 'react';

import { useSearchCenter } from '@/data/hooks';
import { distanceMeters } from '@/domain/geo/distance';
import { estimateTravelMinutes, leaveAt } from '@/domain/geo/travel';
import type { Appointment, Practice } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { usePreferences } from '@/state/preferences';

import {
  removeAppointmentFromCalendar,
  syncAppointmentToCalendar,
  useCalendarSync,
} from './calendarSync';
import {
  cancelReminders,
  notificationPermission,
  scheduleReminders,
  type LeaveReminder,
} from './notifications';

type AppointmentLike = Pick<Appointment, 'id' | 'startsAt' | 'endsAt' | 'visitType'>;
type PracticeLike = Pick<Practice, 'name' | 'address' | 'location'>;

/**
 * Was nach Buchen, Verschieben und Storno auf dem Gerät passiert – an einer Stelle:
 * Erinnerungen 24 h/2 h, „Jetzt losfahren“ (Feature 4) und Kalender-Sync.
 * Alles lokal; ohne Erlaubnis für Mitteilungen werden nur Kalendereinträge gepflegt.
 */
export function useAppointmentEffects() {
  const { t, locale } = useT();
  const center = useSearchCenter().center;
  const remindersEnabled = usePreferences((s) => s.remindersEnabled);
  const leaveEnabled = usePreferences((s) => s.leaveReminder);
  const travelMode = usePreferences((s) => s.travelMode);
  const calendarSync = useCalendarSync((s) => s.enabled);

  return useMemo(() => {
    const leaveFor = (a: AppointmentLike, practice: PracticeLike): LeaveReminder | null => {
      if (!leaveEnabled || a.visitType === 'video' || !center) return null;
      const distanceM = distanceMeters(center, practice.location);
      const minutes = estimateTravelMinutes(distanceM, travelMode);
      return {
        at: leaveAt(new Date(a.startsAt), distanceM, travelMode),
        travel:
          minutes === null
            ? null
            : t('travel.withMode', { count: minutes, mode: t(`travel.by.${travelMode}`) }),
      };
    };

    const plan = async (a: AppointmentLike, practice: PracticeLike) => {
      if (calendarSync) void syncAppointmentToCalendar(a, practice, t);
      if (remindersEnabled && (await notificationPermission()) === 'granted') {
        await scheduleReminders(a, t, locale, leaveFor(a, practice));
      }
    };

    return {
      booked: plan,
      rescheduled: async (previousId: string, next: AppointmentLike, practice: PracticeLike) => {
        await cancelReminders(previousId);
        if (previousId !== next.id) await removeAppointmentFromCalendar(previousId);
        await plan(next, practice);
      },
      cancelled: async (id: string) => {
        await cancelReminders(id);
        await removeAppointmentFromCalendar(id);
      },
      /** Nach nachträglich erteilter Erlaubnis (Erfolgsseite) */
      scheduleNow: (a: AppointmentLike, practice: PracticeLike) =>
        scheduleReminders(a, t, locale, leaveFor(a, practice)),
    };
  }, [t, locale, center, remindersEnabled, leaveEnabled, travelMode, calendarSync]);
}
