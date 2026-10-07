import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { Chip, PressableScale, Text } from '@/components';
import { LocateFixed, Search, Stethoscope, Users } from '@/components/icons';
import { makeStyles, useTheme } from '@/design/theme';
import { SELF } from '@/domain/profiles';
import { SPECIALTIES } from '@/domain/seed/catalog';
import type { TimeWindow } from '@/domain/types';
import { useProfiles } from '@/features/profile/useProfiles';
import { useT } from '@/i18n/useT';
import { useSearchFilters } from '@/state/searchFilters';

/**
 * Block 2 der Startseite – „Wo finde ich schnell einen freien Arzt?“: großes Suchfeld und
 * Schnellfilter (Fachrichtung, Nächste 24 Std./Diese Woche, Umkreis). Jeder Schnellfilter
 * setzt den Suchfilter und öffnet die Suche – ein Tipp bis zum Ergebnis. Die Zeit-Chips sind
 * Aktionen, keine Umschalter (kein „ausgewählt“-Zustand auf der Startseite).
 */
export function QuickSearch() {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const { profiles, active } = useProfiles();
  const radiusKm = useSearchFilters((s) => s.radiusKm);
  const specialtyIds = useSearchFilters((s) => s.specialtyIds);
  const setFilters = useSearchFilters((s) => s.set);
  const specialty =
    specialtyIds.length === 1 ? SPECIALTIES.find((s) => s.id === specialtyIds[0]) : undefined;

  // focus: Zeitstempel, damit jeder Tipp das Suchfeld erneut fokussiert
  const openSearch = (params?: { focus?: string }) =>
    router.navigate({ pathname: '/(tabs)/search', params: { view: 'list', ...params } });
  // Filter-Sheet über der Suche öffnen, damit „Anzeigen“ direkt bei den Treffern landet
  const openFilters = () => {
    openSearch();
    router.push('/filters');
  };
  const pickWindow = (w: TimeWindow) => {
    setFilters({ window: w });
    openSearch();
  };

  return (
    <View style={styles.root}>
      <PressableScale
        onPress={() => openSearch({ focus: String(Date.now()) })}
        // Öffnet die Suche – kein Eingabefeld (im Web wäre „search“ ein Landmark)
        accessibilityRole="button"
        accessibilityLabel={t('home.searchLabel')}
        accessibilityHint={t('home.searchHint')}
        style={styles.field}
        testID="home-search"
      >
        <Search
          size={theme.layout.iconSize.md}
          color={theme.colors.textSecondary}
          strokeWidth={2}
        />
        <Text variant="body" color="textSecondary" numberOfLines={1} style={styles.flex}>
          {t('search.placeholder')}
        </Text>
      </PressableScale>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityLabel={t('home.quickFilters')}
      >
        {profiles.length > 1 ? (
          <Chip
            role="button"
            icon={Users}
            label={
              active.id === SELF
                ? t('booking.patientSelf')
                : t('home.forProfile', { name: active.label })
            }
            selected={active.id !== SELF}
            onPress={openFilters}
            testID="quick-profile"
          />
        ) : null}
        <Chip
          role="button"
          icon={Stethoscope}
          label={specialty ? t(`specialtyShort.${specialty.slug}`) : t('filters.specialty')}
          selected={!!specialty}
          onPress={openFilters}
          testID="quick-specialty"
        />
        <Chip
          role="button"
          label={t('time.next24h')}
          onPress={() => pickWindow('next24h')}
          testID="quick-next24h"
        />
        <Chip
          role="button"
          label={t('time.thisWeek')}
          onPress={() => pickWindow('week')}
          testID="quick-week"
        />
        <Chip
          role="button"
          icon={LocateFixed}
          label={t('filters.radiusValue', { value: radiusKm })}
          accessibilityHint={t('home.radiusHint')}
          onPress={openFilters}
          testID="quick-radius"
        />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { gap: t.space.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    minHeight: 56,
    paddingHorizontal: t.space.md,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surface,
  },
  flex: { flex: 1 },
  // Chips laufen bis an den Rand; rechts Luft, damit „mehr“ erkennbar ist
  chips: { gap: t.space.xs, paddingRight: t.space.xl },
}));
