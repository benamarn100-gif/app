import { useEffect, useState } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { makeStyles, useTheme } from '@/design/theme';

type Props = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Platzhalter mit sanftem Shimmer (bei „Bewegung reduzieren“ statisch). */
export function Skeleton({ width = '100%', height = 16, radius, style }: Props) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(-1);
  useEffect(() => {
    if (reduce) return;
    x.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1);
  }, [reduce, x]);
  const shimmer = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * w }] }));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeletonBase,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {!reduce && w > 0 ? (
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: w }, shimmer]}>
          <LinearGradient
            colors={[
              theme.colors.skeletonBase,
              theme.colors.skeletonHighlight,
              theme.colors.skeletonBase,
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Lade-Platzhalter in Form einer Praxiskarte. */
export function PracticeCardSkeleton({ compact }: { compact?: boolean }) {
  const styles = useStyles();
  return (
    <View
      style={[styles.card, compact && styles.compact]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.row}>
        <Skeleton width={48} height={48} radius={24} />
        <View style={styles.lines}>
          <Skeleton width="80%" height={18} />
          <Skeleton width="50%" height={14} />
        </View>
      </View>
      <Skeleton width={120} height={26} radius={999} />
      <Skeleton width="65%" height={14} />
    </View>
  );
}

export function SkeletonList({ count = 4, compact }: { count?: number; compact?: boolean }) {
  const styles = useStyles();
  return (
    <View style={compact ? styles.hList : styles.vList} testID="skeleton-list">
      {Array.from({ length: count }, (_, i) => (
        <PracticeCardSkeleton key={i} compact={compact} />
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    padding: t.space.md,
    gap: t.space.sm,
    boxShadow: t.shadows.sm,
  },
  compact: { width: 280 }, // wie PracticeCard compact
  row: { flexDirection: 'row', gap: t.space.sm, alignItems: 'center' },
  lines: { flex: 1, gap: t.space.xs },
  vList: { gap: t.space.sm },
  hList: { flexDirection: 'row', gap: t.space.sm },
}));
