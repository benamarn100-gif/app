import { TZDate } from '@date-fns/tz';
import { addDays, getISOWeek, startOfDay } from 'date-fns';

import { APP_TIME_ZONE, toBerlin } from '@app/domain/time/berlin';

export {
  berlinDateTime,
  formatBerlinDate,
  formatBerlinTime,
  minutesSince,
  startOfBerlinDay,
} from '@app/domain/time/berlin';

const pad = (n: number) => String(n).padStart(2, '0');

/** Montag 00:00 (Berlin) der Woche, in der `date` liegt. */
export function startOfBerlinWeek(date: Date): Date {
  const local = toBerlin(date);
  const diff = (local.getDay() + 6) % 7;
  return new Date(startOfDay(addDays(local, -diff)).getTime());
}

/** Berliner Mitternacht `days` Kalendertage später (sommerzeitsicher). */
export function addBerlinDays(date: Date, days: number): Date {
  return new Date(startOfDay(addDays(toBerlin(date), days)).getTime());
}

/** Kalenderdatum in Berlin als YYYY-MM-DD. */
export function berlinIsoDate(date: Date): string {
  const local = toBerlin(date);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

/** Berliner Mitternacht eines YYYY-MM-DD-Datums. */
export function dateFromIso(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, 0, APP_TIME_ZONE).getTime());
}

/** Uhrzeit in Berlin als HH:MM. */
export function berlinHHMM(date: Date | string): string {
  const local = toBerlin(date);
  return `${pad(local.getHours())}:${pad(local.getMinutes())}`;
}

/** ISO-Wochentag in Berlin: 1 = Montag … 7 = Sonntag. */
export function isoWeekday(date: Date): number {
  const day = toBerlin(date).getDay();
  return day === 0 ? 7 : day;
}

export function isoWeekNumber(date: Date): number {
  return getISOWeek(toBerlin(date));
}

/** Name des ISO-Wochentags in der Sprache der Oberfläche. */
export function weekdayName(isoDay: number, locale: string, style: 'long' | 'short' = 'long') {
  // 5. Januar 2026 ist ein Montag.
  const reference = new Date(Date.UTC(2026, 0, 4 + isoDay, 12));
  return new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' }).format(reference);
}

export function minutesOfDay(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
