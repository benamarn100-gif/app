import { forwardRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/design/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Stil, solange das Element den Tastatur-/Schalterfokus hat. */
  focusStyle?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: ReactNode | ((state: { pressed: boolean; focused: boolean }) => ReactNode);
};

/**
 * Drück-Feedback mit Feder (damping 18, stiffness 220). Bei „Bewegung reduzieren“
 * nur eine dezente Deckkraft-Änderung statt Skalierung.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  {
    style,
    focusStyle,
    pressedStyle,
    scaleTo,
    onPressIn,
    onPressOut,
    onFocus,
    onBlur,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const target = scaleTo ?? theme.motion.pressScale;

  const animatedStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - progress.value * 0.15 }
      : { transform: [{ scale: 1 - progress.value * (1 - target) }] },
  );

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      onPressIn={(e) => {
        setPressed(true);
        progress.value = reduceMotion
          ? withTiming(1, { duration: theme.motion.duration.fast })
          : withSpring(1, theme.motion.spring);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        progress.value = reduceMotion
          ? withTiming(0, { duration: theme.motion.duration.fast })
          : withSpring(0, theme.motion.spring);
        onPressOut?.(e);
      }}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[style, animatedStyle, pressed && pressedStyle, focused && focusStyle]}
      {...rest}
    >
      {typeof children === 'function' ? children({ pressed, focused }) : children}
    </AnimatedPressable>
  );
});
