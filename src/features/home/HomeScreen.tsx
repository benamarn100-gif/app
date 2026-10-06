import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Card,
  Chip,
  EmergencyBar,
  EmptyState,
  IllustrationOffline,
  OfflineBanner,
  PracticeCard,
  PressableScale,
  SectionHeader,
  Skeleton,
  SkeletonList,
  SpecialtyIcon,
  Stagger,
  Text,
} from '@/components';
import { ChevronRight, MapPin, Zap } from '@/components/icons';
import { useAppointments, useAvailabilitySearch } from '@/data/hooks';
import { makeStyles, useTheme } from '@/design/theme';
import { rankAcute } from '@/domain/ranking/acute';
import { SPECIALTIES } from '@/domain/seed/catalog';
import { toBerlin } from '@/domain/time/berlin';
import { AppointmentCard } from '@/features/appointments/AppointmentCard';
import { useBasicSearchParams } from '@/features/search/useSearchParams';
import { useT } from '@/i18n/useT';
import { useMarkInteractive } from '@/lib/startup';
import { useNow } from '@/lib/useNow';
import { usePreferences } from '@/state/preferences';
import { useSearchFilters } from '@/state/searchFilters';

import { BrandRefresh } from './BrandRefresh';
import { MapPreview } from './MapPreview';

function greetingKey(now: Date) {
  const hour = toBerlin(now).getHours();
  if (hour >= 5 && hour < 11) return 'greeting.morning' as const;
  if (hour >= 11 && hour < 18) return 'greeting.day' as const;
  if (hour >= 18 && hour < 23) return 'greeting.evening' as const;
  return 'greeting.night' as const;
}

export function HomeScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const now = useNow(60_000);
  const client = useQueryClient();
  const favorites = usePreferences((s) => s.favoriteSpecialtyIds);
  const radiusKm = usePreferences((s) => s.radiusKm);
  const setFilters = useSearchFilters((s) => s.set);
  const today = useBasicSearchParams('today');
  const week = useBasicSearchParams('week');
  const todayQuery = useAvailabilitySearch(today.params);
  const weekQuery = useAvailabilitySearch(week.params);
  const appointments = useAppointments();
  const [refreshing, setRefreshing] = useState(false);

  const todayFree = useMemo(
    () => rankAcute(todayQuery.data ?? []).filter((r) => r.nextSlot),
    [todayQuery.data],
  );
  const weekFree = useMemo(
    () =>
      (weekQuery.data ?? []).filter(
        (r) => r.nextSlot && !todayFree.slice(0, 8).some((x) => x.practice.id === r.practice.id),
      ),
    [weekQuery.data, todayFree],
  );
  const upcoming = useMemo(
    () =>
      (appointments.data ?? [])
        .filter((a) => a.status === 'confirmed' && Date.parse(a.startsAt) > now.getTime())
        .slice(0, 2),
    [appointments.data, now],
  );
  const specialties = useMemo(
    () =>
      [...SPECIALTIES].sort(
        (a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)),
      ),
    [favorites],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await client.invalidateQueries();
    setRefreshing(false);
  }, [client]);

  const openPractice = useCallback((id: string) => router.push(`/practice/${id}`), []);
  const openSpecialty = (id: number) => {
    setFilters({ specialtyIds: [id], text: '' });
    router.push('/(tabs)/search');
  };

  const loadError = todayQuery.isError && weekQuery.isError && !todayQuery.data;
  useMarkInteractive('home', !todayQuery.isLoading);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + theme.space.md, paddingBottom: insets.bottom + 96 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
        testID="home"
      >
        <BrandRefresh visible={refreshing} />
        <OfflineBanner />

        {/* Begrüßung + Standort */}
        <View style={styles.header}>
          <Text variant="h1">{t(greetingKey(now))}</Text>
          <PressableScale
            onPress={() => router.push('/location')}
            accessibilityRole="button"
            accessibilityLabel={t('location.chipA11y', { place: today.center.label })}
            style={styles.locationChip}
            testID="location-chip"
          >
            <MapPin size={16} color={theme.colors.primary} strokeWidth={2.25} />
            <Text variant="smallStrong" color="primary" numberOfLines={1}>
              {today.center.label}
            </Text>
          </PressableScale>
        </View>

        {/* Hero: Akut-Modus */}
        <Card
          tone="primary"
          padding="lg"
          onPress={() => router.push('/acute')}
          accessibilityRole="button"
          accessibilityLabel={t('home.heroTitle')}
          accessibilityHint={t('home.heroA11yHint')}
          testID="hero-acute"
          style={styles.hero}
        >
          <View style={styles.heroIcon}>
            <Zap
              size={24}
              color={theme.colors.textOnPrimary}
              strokeWidth={2.25}
              fill={theme.colors.textOnPrimary}
            />
          </View>
          <View style={styles.heroText}>
            <Text variant="h2">{t('home.heroTitle')}</Text>
            <Text variant="body" color="textSecondary">
              {t('home.heroBody')}
            </Text>
            {todayQuery.isLoading ? (
              <Skeleton width={180} height={16} />
            ) : todayQuery.data ? (
              <Text variant="smallStrong" color="primary">
                {todayFree.length > 0
                  ? t('home.heroCount', { count: todayFree.length })
                  : t('home.heroNone')}
              </Text>
            ) : null}
          </View>
          <ChevronRight size={24} color={theme.colors.primary} strokeWidth={2.25} />
        </Card>

        {/* Fachrichtungen */}
        <View style={styles.section}>
          <SectionHeader title={t('home.specialties')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {specialties.map((s) => (
              <Chip
                key={s.id}
                role="button"
                label={t(`specialtyShort.${s.slug}`)}
                icon={(p) => <SpecialtyIcon slug={s.slug} {...p} />}
                onPress={() => openSpecialty(s.id)}
                testID={`specialty-${s.slug}`}
              />
            ))}
          </ScrollView>
        </View>

        {loadError ? (
          <EmptyState
            tone="error"
            illustration={<IllustrationOffline size={140} />}
            title={t('errors.loadPractices')}
            body={t('errors.network')}
            primaryAction={{ label: t('common.retry'), onPress: () => void onRefresh() }}
          />
        ) : (
          <>
            {/* Heute frei */}
            <View style={styles.section}>
              <SectionHeader
                title={t('home.todayNearby')}
                actionLabel={t('common.showAll')}
                onAction={() => router.push('/acute')}
              />
              {todayQuery.isLoading ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <SkeletonList count={2} compact />
                </ScrollView>
              ) : todayFree.length === 0 ? (
                <Card tone="muted">
                  <Text variant="body" color="textSecondary">
                    {t('home.todayEmpty')}
                  </Text>
                </Card>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
                >
                  {todayFree.slice(0, 8).map((item, i) => (
                    <Stagger key={item.practice.id} index={i}>
                      <PracticeCard
                        item={item}
                        variant="compact"
                        onPress={openPractice}
                        testID={`today-card-${i}`}
                      />
                    </Stagger>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Diese Woche frei */}
            <View style={styles.section}>
              <SectionHeader
                title={t('home.thisWeek')}
                actionLabel={t('common.showAll')}
                onAction={() => {
                  setFilters({ window: 'week', specialtyIds: [], text: '' });
                  router.push('/(tabs)/search');
                }}
              />
              {weekQuery.isLoading ? (
                <SkeletonList count={2} />
              ) : weekFree.length === 0 ? (
                <Card tone="muted">
                  <Text variant="body" color="textSecondary">
                    {t('home.weekEmpty')}
                  </Text>
                </Card>
              ) : (
                <View style={styles.vList}>
                  {weekFree.slice(0, 4).map((item, i) => (
                    <Stagger key={item.practice.id} index={i}>
                      <PracticeCard item={item} onPress={openPractice} />
                    </Stagger>
                  ))}
                </View>
              )}
            </View>

            {/* Kartenvorschau */}
            {week.center.center && weekQuery.data ? (
              <MapPreview
                center={week.center.center}
                items={weekQuery.data}
                radiusKm={radiusKm}
                onPress={() => router.push({ pathname: '/(tabs)/search', params: { view: 'map' } })}
              />
            ) : null}
          </>
        )}

        {/* Meine nächsten Termine */}
        <View style={styles.section}>
          <SectionHeader
            title={t('home.nextAppointments')}
            actionLabel={upcoming.length ? t('common.showAll') : undefined}
            onAction={() => router.push('/(tabs)/appointments')}
          />
          {upcoming.length === 0 ? (
            <Text variant="body" color="textSecondary">
              {t('home.noAppointments')}
            </Text>
          ) : (
            upcoming.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                compact
                onPress={() => router.push('/(tabs)/appointments')}
              />
            ))
          )}
        </View>

        <EmergencyBar />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: {
    paddingHorizontal: t.layout.screenPadding,
    gap: t.space.xl,
    maxWidth: t.layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: { gap: t.space.xs },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xxs,
    alignSelf: 'flex-start',
    minHeight: t.layout.touchTarget,
    paddingHorizontal: t.space.sm,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.primarySoft,
    maxWidth: '100%',
  },
  hero: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, boxShadow: t.shadows.md },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: t.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: t.space.xxs },
  section: { gap: t.space.sm },
  chips: { gap: t.space.xs, paddingRight: t.space.md },
  hList: { gap: t.space.sm, paddingRight: t.space.md, paddingVertical: t.space.xxs },
  vList: { gap: t.space.sm },
}));
