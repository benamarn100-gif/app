import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/design/theme';
import { haptics } from '@/lib/haptics';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LENGTH = 64;

/**
 * Signature-Moment 2: Haken zeichnet sich, sanftes Leuchten, Erfolgs-Haptik.
 * Kein Konfetti. Bei „Bewegung reduzieren“ sofort sichtbar.
 */
export function AnimatedCheck({ size = 120, onShown }: { size?: number; onShown?: () => void }) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const draw = useSharedValue(reduce ? 1 : 0);
  const glow = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    haptics.success();
    onShown?.();
    if (reduce) return;
    glow.value = withSpring(1, theme.motion.spring);
    draw.value = withDelay(120, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
  }, [draw, glow, onShown, reduce, theme.motion.spring]);

  const pathProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - draw.value) }));
  const halo = useAnimatedStyle(() => ({
    opacity: 0.55 * glow.value,
    transform: [{ scale: 0.7 + glow.value * 0.45 }],
  }));
  const disc = useAnimatedStyle(() => ({ transform: [{ scale: 0.85 + glow.value * 0.15 }] }));

  return (
    <View
      style={{
        width: size * 1.6,
        height: size * 1.6,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessible={false}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: size,
            backgroundColor: theme.colors.statusFreeSoft,
          },
          halo,
        ]}
      />
      <Animated.View style={disc}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={46} fill={theme.colors.statusFree} />
          <AnimatedPath
            d="M30 52 L44 65 L71 37"
            stroke={theme.colors.surface}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={CHECK_LENGTH}
            animatedProps={pathProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
