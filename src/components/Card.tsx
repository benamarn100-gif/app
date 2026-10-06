import type { ReactNode } from 'react';
import { View, type AccessibilityProps, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles } from '@/design/theme';

import { PressableScale } from './PressableScale';

type Props = AccessibilityProps & {
  children: ReactNode;
  onPress?: () => void;
  tone?: 'surface' | 'muted' | 'primary' | 'accent';
  padding?: 'none' | 'md' | 'lg';
  elevated?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Großzügige Karte mit weichem, mehrschichtigem Schatten. Mit onPress drückbar. */
export function Card({
  children,
  onPress,
  tone = 'surface',
  padding = 'md',
  elevated = true,
  disabled,
  testID,
  style,
  ...a11y
}: Props) {
  const styles = useStyles();
  const composed = [
    styles.base,
    styles[tone],
    padding === 'md' && styles.padMd,
    padding === 'lg' && styles.padLg,
    elevated && tone === 'surface' && styles.elevated,
    disabled && styles.disabled,
    style,
  ];
  if (!onPress) {
    return (
      <View style={composed} testID={testID} {...a11y}>
        {children}
      </View>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={composed}
      focusStyle={styles.focused}
      accessibilityRole={a11y.accessibilityRole ?? 'button'}
      testID={testID}
      scaleTo={0.985}
      {...a11y}
    >
      {children}
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  base: { borderRadius: t.radius.lg, borderWidth: 2, borderColor: 'transparent' },
  surface: { backgroundColor: t.colors.surface },
  muted: { backgroundColor: t.colors.surfaceMuted },
  primary: { backgroundColor: t.colors.primarySoft },
  accent: { backgroundColor: t.colors.accentSoft },
  padMd: { padding: t.space.md },
  padLg: { padding: t.space.xl },
  elevated: { boxShadow: t.shadows.md },
  disabled: { opacity: 0.5 },
  focused: { borderColor: t.colors.focus },
}));
