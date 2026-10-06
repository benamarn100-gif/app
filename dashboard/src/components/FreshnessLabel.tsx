import { Clock } from 'lucide-react';

import { isStale } from '@app/domain/availability/status';

import { useT } from '../i18n';
import { cx } from '../lib/cx';
import { minutesSince } from '../lib/time';

export function useFreshnessText(lastSyncedAt: string | null, now: Date): string {
  const { t, tp } = useT();
  if (!lastSyncedAt) return t('freshness.never');
  const minutes = minutesSince(lastSyncedAt, now);
  if (minutes < 1) return t('freshness.justNow');
  if (minutes < 60) return tp('freshness.minutes', minutes);
  if (minutes < 24 * 60) return tp('freshness.hours', Math.floor(minutes / 60));
  return tp('freshness.days', Math.floor(minutes / (24 * 60)));
}

/** „Aktualisiert vor X Min.“ – veraltete Angaben (> 24 h) werden hervorgehoben. */
export function FreshnessLabel({ lastSyncedAt, now }: { lastSyncedAt: string | null; now: Date }) {
  const text = useFreshnessText(lastSyncedAt, now);
  return (
    <span className={cx('freshness', isStale(lastSyncedAt, now) && 'freshness--stale')}>
      <Clock size={16} aria-hidden />
      {text}
    </span>
  );
}
