import { forwardRef, useState, type ComponentType, type ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { CircleAlert, type LucideProps } from 'lucide-react-native';

import { makeStyles, useTheme } from '@/design/theme';
import { maxFontScale } from '@/design/tokens';

import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  hint?: string;
  error?: string | null;
  icon?: ComponentType<LucideProps>;
  trailing?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * Eingabefeld mit sichtbarem Label, Hinweis und Fehlermeldung.
 * Fehler werden von Screenreadern sofort vorgelesen (Live-Region).
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, icon: Icon, trailing, disabled, loading, onFocus, onBlur, ...rest },
  ref,
) {
  const theme = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? theme.colors.statusBooked
    : focused
      ? theme.colors.focus
      : theme.colors.borderStrong;
  return (
    <View style={styles.container}>
      <Text variant="smallStrong" nativeID={`${label}-label`}>
        {label}
      </Text>
      <View
        style={[
          styles.field,
          { borderColor, borderWidth: focused || error ? 2 : 1.5 },
          disabled && styles.disabled,
        ]}
      >
        {Icon ? (
          <Icon
            size={theme.layout.iconSize.md}
            color={theme.colors.textSecondary}
            strokeWidth={2}
          />
        ) : null}
        <TextInput
          ref={ref}
          editable={!disabled && !loading}
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityState={{ disabled: !!disabled, busy: !!loading }}
          aria-invalid={!!error}
          placeholderTextColor={theme.colors.textSecondary}
          maxFontSizeMultiplier={maxFontScale}
          selectionColor={theme.colors.primary}
          style={[styles.input, theme.typography.body]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {trailing}
      </View>
      {error ? (
        <View
          style={styles.message}
          accessible
          accessibilityLabel={error}
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
        >
          <CircleAlert size={14} color={theme.colors.statusBooked} strokeWidth={2.25} />
          <Text variant="small" color="statusBooked" style={styles.messageText}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="small" color="textSecondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((t) => ({
  container: { gap: t.space.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    minHeight: 52,
    paddingHorizontal: t.space.md,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surface,
  },
  input: {
    flex: 1,
    color: t.colors.textPrimary,
    paddingVertical: t.space.sm,
    minHeight: t.layout.touchTarget,
  },
  disabled: { opacity: 0.5 },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space.xxs },
  messageText: { flex: 1 },
}));
