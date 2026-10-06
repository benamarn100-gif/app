import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Bell, Phone } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  EmergencyBar,
  EmptyState,
  IllustrationOffline,
  IllustrationSearchEmpty,
  OfflineBanner,
  PracticeCard,
  SkeletonList,
  Stagger,
  Text,
} from '@/components';
import { useAvailabilitySearch } from '@/data/hooks';
import { makeStyles } from '@/design/theme';
import { rankAcute } from '@/domain/ranking/acute';
import type { PracticeAvailability } from '@/domain/types';
import { useBasicSearchParams } from '@/features/search/useSearchParams';
import { useT } from '@/i18n/useT';
import { formatSlotWhen } from '@/lib/format';
import { callPhone } from '@/lib/maps';
import { useNow } from '@/lib/useNow';
import { usePreferences } from '@/state/preferences';
import { nextRadius } from '@/state/searchFilters';

type Row =
  | { kind: 'header'; id: string; title: string; hint?: string }
  | {
      kind: 'practice';
      id: string;
      item: PracticeAvailability;
      index: number;
      call?: boolean;
      waitlist?: boolean;
    };

/**
 * Akut-Modus: Praxen in der Nähe mit dem frühesten freien Termin – sortiert nach
 * Uhrzeit, dann Entfernung, dann Bewertung. Ist heute nichts frei, sagen wir das ehrlich
 * und zeigen den frühesten Termin der Woche.
 */
export function AcuteScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const now = useNow(60_000);
  const prefRadius = usePreferences((s) => s.radiusKm);
  const [radius, setRadius] = useState(prefRadius);
  const today = useBasicSearchParams('today', radius);
  const week = useBasicSearchParams('week', radius);
  const todayQuery = useAvailabilitySearch(today.params);
  const todayRanked = useMemo(() => rankAcute(todayQuery.data ?? []), [todayQuery.data]);
  const hasToday = todayRanked.some((r) => r.nextSlot);
  // Nur laden, wenn heute nichts frei ist
  const weekQuery = useAvailabilitySearch(week.params, {
    enabled: todayQuery.isSuccess && !hasToday,
  });
  const source = hasToday ? todayRanked : rankAcute(weekQuery.data ?? []);
  const loading =
    todayQuery.isLoading || (!hasToday && todayQuery.isSuccess && weekQuery.isLoading);

  const rows = useMemo<Row[]>(() => {
    const bookable = source.filter((r) => r.nextSlot);
    const booked = source.filter((r) => !r.nextSlot && r.status !== 'unknown');
    const unknown = source.filter((r) => r.status === 'unknown');
    const out: Row[] = bookable.map((item, index) => ({
      kind: 'practice',
      id: item.practice.id,
      item,
      index,
    }));
    if (unknown.length) {
      out.push({
        kind: 'header',
        id: 'h-unknown',
        title: t('acute.unknownSection'),
        hint: t('acute.unknownHint'),
      });
      unknown.forEach((item, i) =>
        out.push({
          kind: 'practice',
          id: item.practice.id,
          item,
          index: bookable.length + i,
          call: true,
        }),
      );
    }
    if (booked.length && bookable.length < 5) {
      out.push({ kind: 'header', id: 'h-booked', title: t('acute.bookedSection') });
      booked
        .slice(0, 5)
        .forEach((item, i) =>
          out.push({ kind: 'practice', id: item.practice.id, item, index: 99 + i, waitlist: true }),
        );
    }
    return out;
  }, [source, t]);

  const earliest = source.find((r) => r.nextSlot)?.nextSlot;
  const bookableCount = source.filter((r) => r.nextSlot).length;
  const next = nextRadius(radius);
  const openPractice = useCallback((id: string) => router.push(`/practice/${id}`), []);

  const header = (
    <View style={styles.header}>
      <OfflineBanner />
      <Text variant="body" color="textSecondary">
        {t('acute.subtitle')}
      </Text>
      {!loading && !hasToday && earliest ? (
        <Card tone="accent" accessibilityRole="alert" testID="acute-none-today">
          <Text variant="bodyStrong">
            {t('acute.noneToday', { when: formatSlotWhen(earliest.startsAt, now, t, locale) })}
          </Text>
        </Card>
      ) : null}
      {!loading && bookableCount > 0 ? (
        <Text variant="smallStrong" color="textSecondary" accessibilityLiveRegion="polite">
          {t('acute.resultCount', { count: bookableCount })}
        </Text>
      ) : null}
    </View>
  );

  if (todayQuery.isError && !todayQuery.data) {
    return (
      <View style={styles.root}>
        <EmptyState
          tone="error"
          illustration={<IllustrationOffline size={150} />}
          title={t('errors.loadPractices')}
          body={t('errors.network')}
          primaryAction={{ label: t('common.retry'), onPress: () => void todayQuery.refetch() }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="acute-screen">
      <FlashList
        data={loading ? [] : rows}
        keyExtractor={(row) => row.id}
        getItemType={(row) => row.kind}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={4} />
          ) : (
            <EmptyState
              illustration={<IllustrationSearchEmpty size={150} />}
              title={t('empty.radius', { radius })}
              primaryAction={
                next
                  ? {
                      label: t('empty.radiusAction', { radius: next }),
                      onPress: () => setRadius(next),
                      testID: 'expand-radius',
                    }
                  : undefined
              }
              secondaryAction={{
                label: t('empty.waitlistAction'),
                onPress: () => router.push('/waitlist/any'),
              }}
              testID="acute-empty"
            />
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <EmergencyBar />
          </View>
        }
        renderItem={({ item: row }) =>
          row.kind === 'header' ? (
            <View style={styles.sectionHeader}>
              <Text variant="h3">{row.title}</Text>
              {row.hint ? (
                <Text variant="small" color="textSecondary">
                  {row.hint}
                </Text>
              ) : null}
            </View>
          ) : (
            <Stagger index={row.index}>
              <View style={styles.item}>
                <PracticeCard
                  item={row.item}
                  onPress={openPractice}
                  testID={`acute-result-${row.index}`}
                />
                {row.call && row.item.practice.phone ? (
                  <Button
                    variant="secondary"
                    icon={Phone}
                    label={t('common.call')}
                    accessibilityLabel={t('practice.callA11y', { phone: row.item.practice.phone })}
                    onPress={() => callPhone(row.item.practice.phone!)}
                  />
                ) : null}
                {row.waitlist ? (
                  <Button
                    variant="text"
                    icon={Bell}
                    label={t('acute.waitlistCta')}
                    onPress={() => router.push(`/waitlist/${row.item.practice.id}`)}
                  />
                ) : null}
              </View>
            </Stagger>
          )
        }
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  header: { gap: t.space.sm, paddingTop: t.space.xs, paddingBottom: t.space.md },
  sectionHeader: { gap: 2, paddingTop: t.space.lg, paddingBottom: t.space.sm },
  item: { gap: t.space.xs, paddingBottom: t.space.sm },
  footer: { paddingTop: t.space.lg },
}));
