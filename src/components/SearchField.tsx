import { forwardRef, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { makeStyles, useTheme } from '@/design/theme';
import { maxFontScale } from '@/design/tokens';
import { useT } from '@/i18n/useT';

import { Search, X } from './icons';

type Props = Omit<TextInputProps, 'style' | 'onChangeText' | 'value'> & {
  value: string;
  onChangeText: (value: string) => void;
  label: string;
  error?: boolean;
  disabled?: boolean;
};

/** Suchfeld mit Lupe und Löschen-Button (48 dp). */
export const SearchField = forwardRef<TextInput, Props>(function SearchField(
  { value, onChangeText, label, error, disabled, onFocus, onBlur, ...rest },
  ref,
) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.field,
        focused && { borderColor: theme.colors.focus, borderWidth: 2 },
        error && { borderColor: theme.colors.statusBooked, borderWidth: 2 },
        disabled && styles.disabled,
      ]}
    >
      <Search size={theme.layout.iconSize.md} color={theme.colors.textSecondary} strokeWidth={2} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        accessibilityLabel={label}
        accessibilityRole="search"
        placeholderTextColor={theme.colors.textSecondary}
        maxFontSizeMultiplier={maxFontScale}
        returnKeyType="search"
        autoCorrect={false}
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
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel={t('search.clear')}
          hitSlop={12}
          style={styles.clear}
        >
          <X size={theme.layout.iconSize.md} color={theme.colors.textSecondary} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((t) => ({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    minHeight: t.layout.touchTarget + 4,
    paddingHorizontal: t.space.md,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    boxShadow: t.shadows.sm,
  },
  input: { flex: 1, color: t.colors.textPrimary, minHeight: t.layout.touchTarget },
  clear: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
}));
