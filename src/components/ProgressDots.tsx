import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { makeStyles, useTheme } from '@/design/theme';
import { useT } from '@/i18n/useT';

type Props = {
  total: number;
  current: number;
  /** Auf dunklem/primärem Grund (z. B. im Button) */
  tone?: 'default' | 'onPrimary';
};

/** Fortschrittspunkte (Onboarding, Buchungsschritte). Aktiver Punkt wird zur Pille. */
export function ProgressDots({ total, current, tone = 'default' }: Props) {
  const styles = useStyles();
  const { t } = useT();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.stepOf', { current: current + 1, total })}
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <Dot key={i} active={i === current} done={i < current} tone={tone} />
      ))}
    </View>
  );
}

function Dot({ active, done, tone }: { active: boolean; done: boolean; tone: Props['tone'] }) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const width = useSharedValue(active ? 24 : 8);
  useEffect(() => {
    width.value = reduce
      ? withTiming(active ? 24 : 8, { duration: 0 })
      : withSpring(active ? 24 : 8, theme.motion.spring);
  }, [active, reduce, theme.motion.spring, width]);
  const style = useAnimatedStyle(() => ({ width: width.value }));
  const on = tone === 'onPrimary' ? theme.colors.textOnPrimary : theme.colors.primary;
  const off = tone === 'onPrimary' ? theme.colors.primaryPressed : theme.colors.borderStrong;
  return (
    <Animated.View
      style={[
        { height: 8, borderRadius: theme.radius.pill, backgroundColor: active || done ? on : off },
        style,
      ]}
    />
  );
}

/** Dezente Lade-Animation (drei pulsierende Punkte) – statt eines Spinners in Buttons. */
export function LoadingDots({ color }: { color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row} accessible={false} importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((i) => (
        <PulseDot key={i} index={i} color={color} />
      ))}
    </View>
  );
}

function PulseDot({ index, color }: { index: number; color: string }) {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    if (reduce) {
      opacity.value = 0.8;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: index * 120 }),
        withTiming(1, { duration: 300 }),
        withTiming(0.35, { duration: 300 }),
      ),
      -1,
    );
  }, [index, opacity, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]}
    />
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
}));
