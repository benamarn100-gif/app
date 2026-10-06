import type { ReactNode } from 'react';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

import { motion } from '@/design/tokens';

/**
 * Listen-Stagger: 40 ms Versatz, höchstens 8 Elemente animiert (Vorgabe).
 * Bei „Bewegung reduzieren“ nur kurzes Einblenden.
 *
 * `animateLayout`: Entfernen/Einfügen gleiten die Nachbarn nach (Storno, Alarm löschen)
 * statt zu springen – nur für nicht virtualisierte Listen (ScrollView/map). In FlashList
 * werden Zellen wiederverwendet; dort keine Layout-Animation.
 */
export function Stagger({
  index,
  animateLayout = false,
  children,
}: {
  index: number;
  animateLayout?: boolean;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const layout = animateLayout && !reduce ? listLayoutTransition() : undefined;
  const exiting = animateLayout ? FadeOut.duration(motion.duration.fast) : undefined;
  if (index >= motion.stagger.maxItems) {
    return (
      <Animated.View layout={layout} exiting={exiting}>
        {children}
      </Animated.View>
    );
  }
  const delay = index * motion.stagger.step;
  const entering = reduce
    ? FadeIn.duration(motion.duration.fast)
    : FadeInDown.delay(delay)
        .duration(motion.duration.slow)
        .springify()
        .damping(motion.spring.damping)
        .stiffness(motion.spring.stiffness);
  return (
    <Animated.View entering={entering} layout={layout} exiting={exiting}>
      {children}
    </Animated.View>
  );
}

/** Nachrutschen der Nachbarn mit der Standard-Feder (UI-Thread). */
export function listLayoutTransition() {
  return LinearTransition.springify()
    .damping(motion.spring.damping)
    .stiffness(motion.spring.stiffness);
}
