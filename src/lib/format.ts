import { berlinDayOffset, formatBerlinDate, formatBerlinTime } from '@/domain/time/berlin';
import type { TFn } from '@/i18n/useT';

/** „2,3 km“ / „850 m“ – lokalisiert, sinnvoll gerundet. */
export function formatDistance(meters: number | null, t: TFn, locale: string): string | null {
  if (meters == null) return null;
  if (meters < 1000) {
    return t('common.distanceM', { value: Math.max(50, Math.round(meters / 50) * 50) });
  }
  const km = meters / 1000;
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(
    km,
  );
  return t('common.distanceKm', { value });
}

/** „Heute 14:30“, „Morgen 08:15“, „Do., 9. Okt. 10:00“ (Berliner Zeit). */
export function formatSlotWhen(iso: string, now: Date, t: TFn, locale: string): string {
  const time = formatBerlinTime(iso, locale);
  const offset = berlinDayOffset(iso, now);
  const day =
    offset === 0
      ? t('time.today')
      : offset === 1
        ? t('time.tomorrow')
        : formatBerlinDate(iso, locale, { weekday: 'short', day: 'numeric', month: 'short' });
  return t('time.dayAtTime', { day, time });
}

/** Lange Datumsform für Zusammenfassungen: „Dienstag, 6. Oktober 2026“. */
export function formatLongDate(iso: string, locale: string): string {
  return formatBerlinDate(iso, locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Countdown „4:59“ */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
