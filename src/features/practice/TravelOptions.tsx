import type { ComponentType } from 'react';
import { View } from 'react-native';
import type { LucideProps } from 'lucide-react-native';

import { PressableScale, Text } from '@/components';
import { Car, Footprints, TramFront } from '@/components/icons';
import { makeStyles, useTheme } from '@/design/theme';
import { estimateTravelMinutes, isWalkable, type TravelMode } from '@/domain/geo/travel';
import type { Practice } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { openRoute } from '@/lib/maps';
import { usePreferences } from '@/state/preferences';

const ICON: Record<TravelMode, ComponentType<LucideProps>> = {
  walk: Footprints,
  car: Car,
  transit: TramFront,
};

/**
 * Anfahrt (Feature 3): je Verkehrsmittel eine grobe Wegezeit („ca.“, aus der Luftlinie) und
 * ein Tipp öffnet die Route in der Karten-App. ÖPNV ohne Schätzung – dafür fehlen Fahrplandaten.
 * Nutzen: Auf einen Blick sehen, ob die Praxis zu Fuß, mit Auto oder Bahn gut erreichbar ist.
 * Das bevorzugte Verkehrsmittel (Profil) steht vorn und dient „Jetzt losfahren“.
 */
export function TravelOptions({
  practice,
  distanceM,
}: {
  practice: Pick<Practice, 'name' | 'location' | 'address'>;
  /** Luftlinie vom Suchort; null = Ort unbekannt (dann nur Routen-Tasten) */
  distanceM: number | null;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const preferred = usePreferences((s) => s.travelMode);
  const modes: TravelMode[] = (['walk', 'car', 'transit'] as const).filter(
    (m) => m !== 'walk' || distanceM === null || isWalkable(distanceM),
  );
  modes.sort((a, b) => Number(b === preferred) - Number(a === preferred));

  return (
    <View style={styles.root}>
      <View style={styles.row} accessibilityRole="toolbar" accessibilityLabel={t('travel.title')}>
        {modes.map((mode) => {
          const Icon = ICON[mode];
          const minutes = distanceM === null ? null : estimateTravelMinutes(distanceM, mode);
          const value =
            minutes === null ? t('travel.route') : t('travel.minutes', { count: minutes });
          return (
            <PressableScale
              key={mode}
              onPress={() => void openRoute(practice, mode)}
              accessibilityRole="button"
              accessibilityLabel={t('travel.a11y', { mode: t(`travel.mode.${mode}`), value })}
              accessibilityHint={t('practice.routeA11y')}
              style={styles.option}
              testID={`travel-${mode}`}
            >
              <Icon size={22} color={theme.colors.primary} strokeWidth={2.25} />
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {t(`travel.mode.${mode}`)}
              </Text>
              <Text variant="smallStrong" color="primary" numberOfLines={1}>
                {value}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      {distanceM !== null ? (
        <Text variant="caption" color="textSecondary">
          {t('travel.note')}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { gap: t.space.xs },
  row: { flexDirection: 'row', gap: t.space.xs },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    minHeight: 72,
    paddingVertical: t.space.xs,
    paddingHorizontal: t.space.xxs,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.primarySoft,
    justifyContent: 'center',
  },
}));
