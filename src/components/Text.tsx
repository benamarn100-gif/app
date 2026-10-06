import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { maxFontScale, type ColorTokens, type TypeVariant } from '@/design/tokens';
import { useTheme } from '@/design/theme';

export type TextColor = Extract<
  keyof ColorTokens,
  | 'textPrimary'
  | 'textSecondary'
  | 'textOnPrimary'
  | 'textOnAccent'
  | 'primary'
  | 'statusFree'
  | 'statusFew'
  | 'statusBooked'
  | 'statusUnknown'
>;

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: TextColor;
  align?: 'left' | 'center' | 'right';
  /** Überschriften werden für Screenreader als „Überschrift“ angesagt. */
  heading?: boolean;
};

const HEADINGS: TypeVariant[] = ['display', 'h1', 'h2', 'h3'];

/**
 * Basistext. Skaliert mit der Systemschrift bis 200 % (Dynamic Type) und
 * schneidet nie ab, solange kein numberOfLines gesetzt ist.
 */
export function Text({
  variant = 'body',
  color = 'textPrimary',
  align,
  heading,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const isHeading = heading ?? HEADINGS.includes(variant);
  return (
    <RNText
      accessibilityRole={isHeading ? 'header' : rest.accessibilityRole}
      maxFontSizeMultiplier={maxFontScale}
      {...rest}
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        align && { textAlign: align },
        style,
      ]}
    />
  );
}
