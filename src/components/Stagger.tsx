import type { ReactNode } from 'react';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { motion } from '@/design/tokens';

/**
 * Listen-Stagger: 40 ms Versatz, höchstens 8 Elemente animiert (Vorgabe).
 * Bei „Bewegung reduzieren“ nur kurzes Einblenden.
 */
export function Stagger({ index, children }: { index: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  if (index >= motion.stagger.maxItems) return <Animated.View>{children}</Animated.View>;
  const delay = index * motion.stagger.step;
  const entering = reduce
    ? FadeIn.duration(motion.duration.fast)
    : FadeInDown.delay(delay)
        .duration(motion.duration.slow)
        .springify()
        .damping(motion.spring.damping)
        .stiffness(motion.spring.stiffness);
  return <Animated.View entering={entering}>{children}</Animated.View>;
}
