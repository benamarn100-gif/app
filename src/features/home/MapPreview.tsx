import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Card, Text } from '@/components';
import { Map as MapIcon } from '@/components/icons';
import { makeStyles, useTheme } from '@/design/theme';
import type { LatLng, PracticeAvailability } from '@/domain/types';
import { useT } from '@/i18n/useT';

type Props = {
  center: LatLng;
  items: PracticeAvailability[];
  radiusKm: number;
  onPress: () => void;
};

/**
 * Kartenvorschau als leichte Illustration (keine Live-Karte auf der Startseite →
 * schneller Start). Punkte sind dekorativ; Status steht in Liste und Karte.
 */
export function MapPreview({ center, items, radiusKm, onPress }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const W = 320;
  const H = 140;
  const dots = useMemo(() => {
    const kmPerDegLat = 111;
    const kmPerDegLng = 111 * Math.cos((center.lat * Math.PI) / 180);
    return items.slice(0, 60).map((item) => {
      const dx = (item.practice.location.lng - center.lng) * kmPerDegLng;
      const dy = (item.practice.location.lat - center.lat) * kmPerDegLat;
      return {
        id: item.practice.id,
        x: W / 2 + (dx / radiusKm) * (W / 2),
        y: H / 2 - (dy / radiusKm) * (H / 2),
        color:
          item.status === 'free'
            ? theme.colors.statusFree
            : item.status === 'few'
              ? theme.colors.statusFew
              : item.status === 'booked'
                ? theme.colors.statusBooked
                : theme.colors.statusUnknown,
      };
    });
  }, [center, items, radiusKm, theme]);

  return (
    <Card
      onPress={onPress}
      padding="none"
      accessibilityRole="button"
      accessibilityLabel={`${t('home.openMap')}. ${t('home.mapPreviewCount', { count: items.length })}`}
      testID="map-preview"
    >
      <View
        style={styles.mapArea}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
          <Rect x={0} y={0} width={W} height={H} fill={theme.colors.surfaceMuted} />
          <Path
            d="M-10 90 C 60 60, 120 120, 200 80 S 300 40, 340 70"
            stroke={theme.colors.blobTeal}
            strokeWidth={14}
            fill="none"
          />
          <Path
            d="M40 -10 L 120 150 M 230 -10 L 180 150 M -10 30 L 330 50"
            stroke={theme.colors.border}
            strokeWidth={3}
            fill="none"
          />
          {dots.map((d) => (
            <Circle
              key={d.id}
              cx={d.x}
              cy={d.y}
              r={5}
              fill={d.color}
              stroke={theme.colors.surface}
              strokeWidth={2}
            />
          ))}
          <Circle
            cx={W / 2}
            cy={H / 2}
            r={8}
            fill={theme.colors.primary}
            stroke={theme.colors.surface}
            strokeWidth={3}
          />
        </Svg>
      </View>
      <View style={styles.footer}>
        <MapIcon size={18} color={theme.colors.primary} strokeWidth={2} />
        <Text variant="bodyStrong" style={styles.label}>
          {t('home.mapPreviewCount', { count: items.length })}
        </Text>
        <Text variant="smallStrong" color="primary">
          {t('home.openMap')}
        </Text>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  mapArea: {
    borderTopLeftRadius: t.radius.lg,
    borderTopRightRadius: t.radius.lg,
    overflow: 'hidden',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    padding: t.space.md,
    flexWrap: 'wrap',
  },
  label: { flex: 1 },
}));
