import type { ComponentType } from 'react';
import { View, type AccessibilityProps, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideProps } from 'lucide-react-native';

import { makeStyles, useTheme } from '@/design/theme';

import { PressableScale } from './PressableScale';
import { LoadingDots } from './ProgressDots';
import { Text } from './Text';

/** danger: nur für Notruf-Aktionen (rot, Kontrast wie „primary“ geprüft) */
export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

export type ButtonProps = AccessibilityProps & {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: ComponentType<LucideProps>;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  /** Fehlerzustand: z. B. nach fehlgeschlagener Aktion (Rahmen in Fehlerfarbe). */
  error?: boolean;
  fullWidth?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Button mit allen Zuständen: Default, Gedrückt, Deaktiviert, Fokus, Laden, Fehler.
 * Mindesthöhe 48 dp. Laden zeigt pulsierende Punkte statt Spinner.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  iconPosition = 'left',
  disabled,
  loading,
  error,
  fullWidth,
  testID,
  style,
  ...a11y
}: ButtonProps) {
  const theme = useTheme();
  const styles = useStyles();
  const inactive = disabled || loading;

  const filled = variant === 'primary' || variant === 'danger';
  const fg = filled
    ? theme.colors.textOnPrimary
    : error
      ? theme.colors.statusBooked
      : theme.colors.primary;

  return (
    <PressableScale
      testID={testID}
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={a11y.accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      accessibilityHint={a11y.accessibilityHint}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'text' && styles.text,
        variant === 'danger' && styles.primaryError,
        error && !filled && styles.error,
        error && variant === 'primary' && styles.primaryError,
        disabled && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
      pressedStyle={
        variant === 'danger'
          ? { opacity: 0.9 }
          : variant === 'primary'
            ? { backgroundColor: error ? theme.colors.statusBooked : theme.colors.primaryPressed }
            : { backgroundColor: theme.colors.primarySoft }
      }
      focusStyle={styles.focused}
    >
      {loading ? (
        <View style={styles.content}>
          <LoadingDots color={fg} />
          <Text variant="label" style={{ color: fg }}>
            {label}
          </Text>
        </View>
      ) : (
        <View style={[styles.content, iconPosition === 'right' && styles.reverse]}>
          {Icon ? <Icon size={theme.layout.iconSize.md} color={fg} strokeWidth={2} /> : null}
          <Text variant="label" style={{ color: fg, flexShrink: 1 }} align="center">
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  base: {
    minHeight: t.layout.touchTarget,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.space.xl,
    paddingVertical: t.space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  primary: { backgroundColor: t.colors.primary, boxShadow: t.shadows.sm },
  secondary: { backgroundColor: t.colors.primarySoft },
  text: { backgroundColor: 'transparent', paddingHorizontal: t.space.sm },
  error: { borderColor: t.colors.statusBooked },
  primaryError: { backgroundColor: t.colors.statusBooked },
  disabled: { opacity: 0.45 },
  fullWidth: { alignSelf: 'stretch' },
  focused: { borderColor: t.colors.focus, outlineWidth: 0 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space.xs,
  },
  reverse: { flexDirection: 'row-reverse' },
}));
