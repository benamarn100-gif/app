import type { ComponentType } from 'react';
import { View } from 'react-native';
import type { LucideProps } from 'lucide-react-native';

import { makeStyles, useTheme } from '@/design/theme';
import { haptics } from '@/lib/haptics';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string; icon?: ComponentType<LucideProps> };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  testID?: string;
};

/** Umschalter (z. B. Karte/Liste, Kommend/Vergangen). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: Props<T>) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View
      style={styles.track}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        const fg = selected ? theme.colors.textOnPrimary : theme.colors.textPrimary;
        return (
          <PressableScale
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            onPress={() => {
              if (!selected) {
                haptics.selection();
                onChange(option.value);
              }
            }}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            style={[styles.segment, selected && styles.selected]}
            focusStyle={styles.focused}
          >
            <View style={styles.row}>
              {Icon ? <Icon size={16} color={fg} strokeWidth={2.25} /> : null}
              <Text variant="smallStrong" style={{ color: fg }}>
                {option.label}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  track: {
    flexDirection: 'row',
    backgroundColor: t.colors.surfaceMuted,
    borderRadius: t.radius.pill,
    padding: t.space.xxs,
    gap: t.space.xxs,
  },
  segment: {
    flex: 1,
    minHeight: t.layout.touchTarget - 4,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.space.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: { backgroundColor: t.colors.primary, boxShadow: t.shadows.sm },
  focused: { borderColor: t.colors.focus },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.xxs + 2 },
}));
