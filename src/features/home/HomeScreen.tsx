import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmergencyBar, OfflineBanner, PressableScale, Stagger, Text } from '@/components';
import { MapPin } from '@/components/icons';
import { useAppointments, useAvailabilitySearch } from '@/data/hooks';
import { makeStyles, useTheme } from '@/design/theme';
import { rankAcute } from '@/domain/ranking/acute';
import { toBerlin } from '@/domain/time/berlin';
import { useBasicSearchParams } from '@/features/search/useSearchParams';
import { useT } from '@/i18n/useT';
import { useMarkInteractive } from '@/lib/startup';
import { useNow } from '@/lib/useNow';
import { usePreferences } from '@/state/preferences';

import { BrandRefresh } from './BrandRefresh';
import { MyPractices } from './MyPractices';
import { NearbyFree } from './NearbyFree';
import { NextAppointmentHero } from './NextAppointmentHero';
import { QuickSearch } from './QuickSearch';

function greetingKey(now: Date) {
  const hour = toBerlin(now).getHours();
  if (hour >= 5 && hour < 11) return 'greeting.morning' as const;
  if (hour >= 11 && hour < 18) return 'greeting.day' as const;
  if (hour >= 18 && hour < 23) return 'greeting.evening' as const;
  return 'greeting.night' as const;
}

/**
 * Startseite – beantwortet in 3 Sekunden „Was ist mein nächster Termin, und wo finde ich
 * schnell einen freien Arzt?“. Höchstens fünf Blöcke:
 * 1. Nächster Termin (oder Akut-Einstieg), 2. Suche mit Schnellfiltern,
 * 3. Frei in deiner Nähe, 4. Deine Praxen (nur wenn vorhanden), 5. Notruf-Leiste.
 * Alles Weitere (Verlauf, Einstellungen, Hilfe) liegt in „Termine“ und „Profil“.
 */
export function HomeScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const now = useNow(60_000);
  const client = useQueryClient();
  const prefRadius = usePreferences((s) => s.radiusKm);
  const setPreferences = usePreferences((s) => s.set);
  const soon = useBasicSearchParams('next24h');
  const soonQuery = useAvailabilitySearch(soon.params);
  const soonFree = useMemo(
    () => rankAcute(soonQuery.data ?? []).filter((r) => r.nextSlot),
    [soonQuery.data],
  );
  // Rückfall „diese Woche“ nur laden, wenn in 24 Stunden nichts frei ist
  const week = useBasicSearchParams('week');
  const weekQuery = useAvailabilitySearch(week.params, {
    enabled: soonQuery.isSuccess && soonFree.length === 0,
  });
  const weekFree = useMemo(
    () => rankAcute(weekQuery.data ?? []).filter((r) => r.nextSlot),
    [weekQuery.data],
  );
  const useWeek = soonQuery.isSuccess && soonFree.length === 0;

  const appointments = useAppointments();
  const nextAppointment = useMemo(
    () =>
      (appointments.data ?? [])
        .filter((a) => a.status === 'confirmed' && Date.parse(a.endsAt) > now.getTime())
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0] ?? null,
    [appointments.data, now],
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await client.invalidateQueries();
    setRefreshing(false);
  }, [client]);

  useMarkInteractive('home', !soonQuery.isLoading);

  const nearbyLoading = soonQuery.isLoading || (useWeek && weekQuery.isLoading);
  const nearbyError = soonQuery.isError && !soonQuery.data;

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

        {/* Begrüßung + Standort in einer Zeile */}
        <View style={styles.header}>
          <Text variant="h2" accessibilityRole="header" style={styles.greeting}>
            {t(greetingKey(now))}
          </Text>
          <PressableScale
            onPress={() => router.push('/location')}
            accessibilityRole="button"
            accessibilityLabel={t('location.chipA11y', { place: soon.center.label })}
            style={styles.locationChip}
            testID="location-chip"
          >
            <MapPin size={16} color={theme.colors.primary} strokeWidth={2.25} />
            <Text variant="smallStrong" color="primary" numberOfLines={1} style={styles.shrink}>
              {soon.center.label}
            </Text>
          </PressableScale>
        </View>

        <Stagger index={0}>
          <NextAppointmentHero
            appointment={nextAppointment}
            loading={appointments.isLoading}
            now={now}
            center={soon.center.center}
            freeSoonCount={soonQuery.data ? soonFree.length : undefined}
          />
        </Stagger>

        <Stagger index={1}>
          <QuickSearch />
        </Stagger>

        <Stagger index={2}>
          <NearbyFree
            items={useWeek ? weekFree : soonFree}
            window={useWeek ? 'week' : 'next24h'}
            loading={nearbyLoading}
            error={nearbyError}
            radiusKm={prefRadius}
            onRetry={() => void soonQuery.refetch()}
            onExpandRadius={(km) => setPreferences({ radiusKm: km })}
          />
        </Stagger>

        <Stagger index={3}>
          <MyPractices appointments={appointments.data ?? []} now={now} />
        </Stagger>

        <Stagger index={4}>
          <EmergencyBar />
        </Stagger>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: t.space.xs,
  },
  greeting: { flexShrink: 1 },
  shrink: { flexShrink: 1 },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xxs,
    minHeight: t.layout.touchTarget,
    paddingHorizontal: t.space.sm,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.primarySoft,
    maxWidth: '60%',
  },
}));
