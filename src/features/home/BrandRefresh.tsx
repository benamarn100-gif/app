import { useEffect } from 'react';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/design/theme';

/**
 * Signature-Moment 4: dezente Marken-Animation beim Pull-to-Refresh –
 * ein atmender Blob mit Herz-Pin statt eines Spinners.
 */
export function BrandRefresh({ visible }: { visible: boolean }) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!visible || reduce) return;
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [visible, reduce, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + t.value * 0.15 }, { rotate: `${t.value * 12}deg` }],
    opacity: 0.7 + t.value * 0.3,
  }));
  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[{ alignSelf: 'center', marginVertical: 8 }, style]}
      accessible={false}
    >
      <Svg width={40} height={40} viewBox="-100 -100 200 200">
        <Path
          d="M60,-58C76,-42,86,-21,85,-1C84,19,72,38,56,52C40,66,20,75,-2,77C-24,79,-48,74,-62,60C-76,46,-80,23,-79,1C-78,-21,-72,-42,-58,-58C-44,-74,-22,-85,-1,-84C20,-83,44,-74,60,-58Z"
          fill={theme.colors.primarySoft}
        />
        <Path
          d="M0 -50c-24 0-42 18-42 41 0 30 42 70 42 70s42-40 42-70c0-23-18-41-42-41z"
          fill={theme.colors.primary}
        />
        <Path
          d="M0 4c-1 0-13-8-13-17 0-5 4-9 8.5-9 2 0 3.7 1 4.5 2.2.8-1.2 2.5-2.2 4.5-2.2 4.5 0 8.5 4 8.5 9 0 9-12 17-13 17z"
          fill={theme.colors.accent}
        />
      </Svg>
    </Animated.View>
  );
}
