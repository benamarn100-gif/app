import { TZDate } from '@date-fns/tz';
import { addDays } from 'date-fns/addDays';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { endOfDay } from 'date-fns/endOfDay';
import { startOfDay } from 'date-fns/startOfDay';

import type { TimeWindow } from '../types';

/**
 * Alle Termine werden in UTC gespeichert und in Europe/Berlin angezeigt.
 * Diese Helfer berechnen Kalendergrenzen („heute“, „morgen“) in Berliner Zeit,
 * unabhängig von der Zeitzone des Geräts oder Servers – inkl. Sommerzeit.
 */
export const APP_TIME_ZONE = 'Europe/Berlin';

export function toBerlin(date: Date | string | number): TZDate {
  return new TZDate(new Date(date).getTime(), APP_TIME_ZONE);
}

export function startOfBerlinDay(date: Date | string | number): Date {
  return new Date(startOfDay(toBerlin(date)).getTime());
}

export function endOfBerlinDay(date: Date | string | number): Date {
  return new Date(endOfDay(toBerlin(date)).getTime());
}

/** Kalendertag-Differenz in Berliner Zeit (0 = heute, 1 = morgen, -1 = gestern). */
export function berlinDayOffset(date: Date | string, now: Date): number {
  return differenceInCalendarDays(toBerlin(date), toBerlin(now));
}

export type Range = { from: Date; to: Date };

/**
 * Zeitfenster für Status und Suche:
 * - today: jetzt bis Tagesende (Berlin)
 * - tomorrow: morgen 00:00 bis 23:59:59 (Berlin)
 * - week: jetzt bis Ende des 7. Kalendertags (heute + 6)
 */
export function windowRange(window: TimeWindow, now: Date): Range {
  switch (window) {
    case 'today':
      return { from: now, to: endOfBerlinDay(now) };
    case 'tomorrow': {
      const tomorrow = addDays(toBerlin(now), 1);
      return {
        from: new Date(startOfDay(tomorrow).getTime()),
        to: new Date(endOfDay(tomorrow).getTime()),
      };
    }
    case 'week':
      return { from: now, to: new Date(endOfDay(addDays(toBerlin(now), 6)).getTime()) };
  }
}

/** Erzeugt einen UTC-Zeitpunkt aus Berliner Datum + Uhrzeit (z. B. '08:15'). */
export function berlinDateTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const base = startOfDay(toBerlin(day));
  const local = new TZDate(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    h ?? 0,
    m ?? 0,
    0,
    0,
    APP_TIME_ZONE,
  );
  return new Date(local.getTime());
}

/** Wochentag (0 = Sonntag … 6 = Samstag) in Berliner Zeit. */
export function berlinWeekday(date: Date | string): number {
  return toBerlin(date).getDay();
}

export function formatBerlinTime(date: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  }).format(new Date(date));
}

export function formatBerlinDate(
  date: Date | string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: APP_TIME_ZONE }).format(
    new Date(date),
  );
}

/** Minuten seit einem Zeitpunkt (für „Aktualisiert vor X Min.“), nie negativ. */
export function minutesSince(date: Date | string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(date).getTime()) / 60000));
}
