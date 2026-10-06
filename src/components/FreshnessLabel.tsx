import { View } from 'react-native';

import { makeStyles, useTheme } from '@/design/theme';
import { isStale } from '@/domain/availability/status';
import { minutesSince } from '@/domain/time/berlin';
import { useT, type TFn } from '@/i18n/useT';
import { useNow } from '@/lib/useNow';

import { Clock } from './icons';
import { Text } from './Text';

export function freshnessText(t: TFn, lastSyncedAt: string | null, now: Date): string {
  if (!lastSyncedAt) return t('time.noData');
  const minutes = minutesSince(lastSyncedAt, now);
  if (minutes < 1) return t('time.updatedJustNow');
  if (minutes < 60) return t('time.updatedMinutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.updatedHoursAgo', { count: hours });
  return t('time.updatedDaysAgo', { count: Math.floor(hours / 24) });
}

/** „Aktualisiert vor X Min.“ – jede Verfügbarkeitsanzeige zeigt ihr Alter. */
export function FreshnessLabel({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const now = useNow();
  const text = freshnessText(t, lastSyncedAt, now);
  const stale = isStale(lastSyncedAt, now);
  return (
    <View style={styles.row} accessible accessibilityLabel={t('time.updatedA11y', { age: text })}>
      <Clock
        size={12}
        color={stale ? theme.colors.statusUnknown : theme.colors.textSecondary}
        strokeWidth={2.25}
      />
      <Text variant="caption" color={stale ? 'statusUnknown' : 'textSecondary'}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.xxs },
}));
