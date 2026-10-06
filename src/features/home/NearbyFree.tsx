import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import {
  Button,
  Card,
  PracticeCard,
  SectionHeader,
  SkeletonList,
  Stagger,
  Text,
} from '@/components';
import { makeStyles } from '@/design/theme';
import type { PracticeAvailability } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { nextRadius } from '@/state/searchFilters';

type Props = {
  /** Praxen mit freiem Termin, bereits nach frühestem Termin sortiert */
  items: PracticeAvailability[];
  /** Zeitraum der Treffer: nächste 24 h oder (Rückfall) diese Woche */
  window: 'next24h' | 'week';
  loading: boolean;
  error: boolean;
  radiusKm: number;
  onRetry: () => void;
  onExpandRadius: (km: number) => void;
};

/**
 * Block 3 der Startseite: Praxen in der Nähe mit dem nächsten freien Termin als
 * horizontale Kartenreihe. Ist in 24 Stunden nichts frei, zeigt der Block ehrlich
 * „diese Woche“ – und ganz ohne Treffer zwei Auswege (Umkreis, Termin-Alarm).
 */
export function NearbyFree({
  items,
  window,
  loading,
  error,
  radiusKm,
  onRetry,
  onExpandRadius,
}: Props) {
  const styles = useStyles();
  const { t } = useT();
  const openPractice = useCallback((id: string) => router.push(`/practice/${id}`), []);
  const next = nextRadius(radiusKm);

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t('home.nearbyTitle')}
        actionLabel={items.length ? t('common.showAll') : undefined}
        onAction={() => router.push('/acute')}
      />
      {/* Die Anzahl für 24 h steht schon im Hero – hier nur der ehrliche Rückfall-Hinweis */}
      {!loading && !error && items.length && window === 'week' ? (
        <Text variant="small" color="textSecondary" accessibilityLiveRegion="polite">
          {t('home.nearbyWeek', { count: items.length })}
        </Text>
      ) : null}
      {loading ? (
        <View style={styles.clip}>
          <SkeletonList count={2} compact />
        </View>
      ) : error ? (
        <Card tone="muted" style={styles.message}>
          <Text variant="body">{t('errors.loadPractices')}</Text>
          <Button variant="secondary" label={t('common.retry')} onPress={onRetry} />
        </Card>
      ) : items.length === 0 ? (
        <Card tone="muted" style={styles.message} testID="nearby-empty">
          <Text variant="body">{t('empty.radius', { radius: radiusKm })}</Text>
          <View style={styles.actions}>
            {next ? (
              <Button
                variant="secondary"
                label={t('empty.radiusAction', { radius: next })}
                onPress={() => onExpandRadius(next)}
              />
            ) : null}
            <Button
              variant="text"
              label={t('alarm.set')}
              onPress={() => router.push('/waitlist/any')}
            />
          </View>
        </Card>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {items.slice(0, 8).map((item, i) => (
            <Stagger key={item.practice.id} index={i}>
              <PracticeCard
                item={item}
                variant="compact"
                window={window}
                onPress={openPractice}
                testID={`nearby-card-${i}`}
              />
            </Stagger>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: { gap: t.space.sm },
  row: { gap: t.space.sm, paddingRight: t.space.xl, paddingVertical: t.space.xxs },
  clip: { overflow: 'hidden' },
  message: { gap: t.space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs, alignItems: 'center' },
}));
