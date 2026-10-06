import type { ComponentType } from 'react';
import { View } from 'react-native';
import type { LucideProps } from 'lucide-react-native';

import { makeStyles, useTheme } from '@/design/theme';
import { haptics } from '@/lib/haptics';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ComponentType<LucideProps>;
  disabled?: boolean;
  /** 'checkbox' für Mehrfachauswahl, 'radio' für Einfachauswahl, 'button' für Aktionen */
  role?: 'checkbox' | 'radio' | 'button';
  accessibilityHint?: string;
  testID?: string;
  size?: 'md' | 'lg';
};

/** Auswahl-Chip, 48 dp hoch. Leichte Haptik bei Auswahl. */
export function Chip({
  label,
  selected = false,
  onPress,
  icon: Icon,
  disabled,
  role = 'checkbox',
  accessibilityHint,
  testID,
  size = 'md',
}: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const fg = selected ? theme.colors.primary : theme.colors.textPrimary;
  return (
    <PressableScale
      testID={testID}
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={
        role === 'button' ? { disabled: !!disabled } : { checked: selected, disabled: !!disabled }
      }
      style={[
        styles.chip,
        size === 'lg' && styles.lg,
        selected ? styles.selected : styles.idle,
        disabled && styles.disabled,
      ]}
      focusStyle={styles.focused}
      pressedStyle={styles.pressed}
    >
      <View style={styles.row}>
        {Icon ? <Icon size={theme.layout.iconSize.sm + 2} color={fg} strokeWidth={2} /> : null}
        <Text variant="smallStrong" style={{ color: fg, flexShrink: 1 }}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  chip: {
    minHeight: t.layout.touchTarget,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.xs,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  lg: { paddingHorizontal: t.space.lg, minHeight: 56 },
  idle: { backgroundColor: t.colors.surface, borderColor: t.colors.borderStrong },
  selected: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary },
  pressed: { backgroundColor: t.colors.surfaceMuted },
  disabled: { opacity: 0.45 },
  focused: { borderColor: t.colors.focus, borderWidth: 2.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
}));
