import { View } from 'react-native';

import { makeStyles, useTheme } from '@/design/theme';

import { ChevronRight } from './icons';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = { title: string; actionLabel?: string; onAction?: () => void; subtitle?: string };

export function SectionHeader({ title, actionLabel, onAction, subtitle }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <Text variant="h3">{title}</Text>
        {subtitle ? (
          <Text variant="small" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <PressableScale
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${title}`}
          style={styles.action}
        >
          <Text variant="smallStrong" color="primary">
            {actionLabel}
          </Text>
          <ChevronRight size={16} color={theme.colors.primary} strokeWidth={2.25} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.sm,
    flexWrap: 'wrap',
  },
  titles: { flexShrink: 1, gap: 2 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: t.layout.touchTarget,
    paddingLeft: t.space.xs,
  },
}));
