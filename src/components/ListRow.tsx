import type { ComponentType, ReactNode } from 'react';
import { Switch, View } from 'react-native';
import { ChevronRight, type LucideProps } from 'lucide-react-native';

import { makeStyles, useTheme } from '@/design/theme';
import { haptics } from '@/lib/haptics';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type BaseProps = {
  title: string;
  subtitle?: string;
  icon?: ComponentType<LucideProps>;
  testID?: string;
  destructive?: boolean;
};

type NavProps = BaseProps & { onPress: () => void; value?: string; trailing?: ReactNode };
type SwitchProps = BaseProps & {
  switchValue: boolean;
  onSwitch: (value: boolean) => void;
  disabled?: boolean;
};

/** Einstellungszeile: Navigation (mit Pfeil) oder Schalter. */
export function ListRow(props: NavProps | SwitchProps) {
  const theme = useTheme();
  const styles = useStyles();
  const Icon = props.icon;
  const titleColor = props.destructive ? 'statusBooked' : 'textPrimary';
  const content = (
    <>
      {Icon ? (
        <View style={styles.icon}>
          <Icon
            size={20}
            color={props.destructive ? theme.colors.statusBooked : theme.colors.primary}
            strokeWidth={2}
          />
        </View>
      ) : null}
      <View style={styles.texts}>
        <Text variant="bodyStrong" color={titleColor}>
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text variant="small" color="textSecondary">
            {props.subtitle}
          </Text>
        ) : null}
      </View>
    </>
  );

  if ('switchValue' in props) {
    return (
      <View style={styles.row} testID={props.testID}>
        {content}
        <Switch
          value={props.switchValue}
          onValueChange={(v) => {
            haptics.selection();
            props.onSwitch(v);
          }}
          disabled={props.disabled}
          accessibilityLabel={props.title}
          accessibilityHint={props.subtitle}
          trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
          thumbColor={theme.colors.surface}
          ios_backgroundColor={theme.colors.borderStrong}
        />
      </View>
    );
  }

  return (
    <PressableScale
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.value ? `${props.title}, ${props.value}` : props.title}
      accessibilityHint={props.subtitle}
      style={styles.row}
      pressedStyle={styles.pressed}
      focusStyle={styles.focused}
      scaleTo={0.99}
      testID={props.testID}
    >
      {content}
      {props.value ? (
        <Text variant="small" color="textSecondary" style={styles.value}>
          {props.value}
        </Text>
      ) : null}
      {props.trailing ?? (
        <ChevronRight size={18} color={theme.colors.textSecondary} strokeWidth={2} />
      )}
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    minHeight: 56,
    paddingVertical: t.space.sm,
    paddingHorizontal: t.space.md,
    borderRadius: t.radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pressed: { backgroundColor: t.colors.surfaceMuted },
  focused: { borderColor: t.colors.focus },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  value: { maxWidth: '40%', textAlign: 'right' },
}));
