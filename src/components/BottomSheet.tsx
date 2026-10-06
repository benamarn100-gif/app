import { forwardRef, useMemo, type ReactNode } from 'react';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { ReduceMotion, useReducedMotion } from 'react-native-reanimated';

import { makeStyles, useTheme } from '@/design/theme';

export type BottomSheetRef = GorhomBottomSheet;

type Props = {
  children: ReactNode;
  /** Standard: 25 / 50 / 90 % (Signature-Moment 3) */
  snapPoints?: (string | number)[];
  index?: number;
  onChange?: (index: number) => void;
  backdrop?: boolean;
  accessibilityLabel?: string;
  /** Unterster Snap-Punkt darf nicht geschlossen werden (Karten-Liste). */
  persistent?: boolean;
};

/** Bottom Sheet mit Feder aus den Tokens; bei „Bewegung reduzieren“ ohne Feder. */
export const BottomSheet = forwardRef<GorhomBottomSheet, Props>(function BottomSheet(
  {
    children,
    snapPoints,
    index = 1,
    onChange,
    backdrop = false,
    accessibilityLabel,
    persistent = true,
  },
  ref,
) {
  const theme = useTheme();
  const styles = useStyles();
  const reduce = useReducedMotion();
  const points = useMemo(() => snapPoints ?? ['25%', '50%', '90%'], [snapPoints]);
  const animationConfigs = useMemo(
    () =>
      reduce
        ? { duration: theme.motion.duration.fast, reduceMotion: ReduceMotion.Never }
        : { ...theme.motion.spring, reduceMotion: ReduceMotion.Never },
    [reduce, theme.motion],
  );
  return (
    <GorhomBottomSheet
      ref={ref}
      index={index}
      snapPoints={points}
      onChange={onChange}
      enablePanDownToClose={!persistent}
      enableDynamicSizing={false}
      animationConfigs={animationConfigs}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.indicator}
      accessible={false}
      accessibilityLabel={accessibilityLabel}
      backdropComponent={
        backdrop
          ? (props: BottomSheetBackdropProps) => (
              <BottomSheetBackdrop
                {...props}
                appearsOnIndex={1}
                disappearsOnIndex={0}
                opacity={0.35}
              />
            )
          : undefined
      }
    >
      {children}
    </GorhomBottomSheet>
  );
});

const useStyles = makeStyles((t) => ({
  background: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    boxShadow: t.shadows.lg,
  },
  indicator: { backgroundColor: t.colors.borderStrong, width: 44, height: 5 },
}));
