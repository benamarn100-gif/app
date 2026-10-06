import { View } from 'react-native';
import { Video } from 'lucide-react-native';

import { makeStyles, useTheme } from '@/design/theme';
import { haptics } from '@/lib/haptics';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  time: string;
  selected?: boolean;
  disabled?: boolean;
  video?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

/** Zeit-Chip im Slot-Picker (Einfachauswahl). */
export function SlotChip({
  time,
  selected,
  disabled,
  video,
  onPress,
  accessibilityLabel,
  testID,
}: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const fg = selected ? theme.colors.textOnPrimary : theme.colors.primary;
  return (
    <PressableScale
      testID={testID}
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? time}
      accessibilityState={{ checked: !!selected, selected: !!selected, disabled: !!disabled }}
      style={[styles.chip, selected && styles.selected, disabled && styles.disabled]}
      focusStyle={styles.focused}
    >
      <View style={styles.row}>
        {video ? <Video size={14} color={fg} strokeWidth={2.25} /> : null}
        <Text variant="smallStrong" style={{ color: fg }}>
          {time}
        </Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  chip: {
    minHeight: t.layout.touchTarget,
    minWidth: 76,
    paddingHorizontal: t.space.sm,
    borderRadius: t.radius.sm,
    borderWidth: 1.5,
    borderColor: t.colors.primary,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  disabled: { opacity: 0.4 },
  focused: { borderWidth: 3, borderColor: t.colors.focus },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.xxs },
}));
