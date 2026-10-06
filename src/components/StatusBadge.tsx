import { View } from 'react-native';

import { makeStyles, useTheme } from '@/design/theme';
import type { AvailabilityStatus } from '@/domain/types';
import { useT } from '@/i18n/useT';

import { STATUS_VISUALS } from './status';
import { Text } from './Text';

type Props = {
  status: AvailabilityStatus;
  size?: 'sm' | 'md';
  /** Eigener Text statt Standardlabel, z. B. „Heute 14:30“. Status bleibt per Icon + Farbe + a11y erkennbar. */
  label?: string;
};

export function StatusBadge({ status, size = 'md', label }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const visual = STATUS_VISUALS[status];
  const Icon = visual.icon;
  const statusText = t(visual.labelKey);
  return (
    <View
      style={[
        styles.badge,
        size === 'sm' && styles.sm,
        { backgroundColor: theme.colors[visual.bg] },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={
        label
          ? `${t('status.a11y', { status: statusText })}, ${label}`
          : t('status.a11y', { status: statusText })
      }
      testID={`status-${status}`}
    >
      <Icon size={size === 'sm' ? 14 : 16} color={theme.colors[visual.fg]} strokeWidth={2.25} />
      <Text
        variant={size === 'sm' ? 'caption' : 'smallStrong'}
        style={{ color: theme.colors[visual.fg] }}
      >
        {label ?? statusText}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: t.space.xxs + 2,
    paddingHorizontal: t.space.sm,
    paddingVertical: t.space.xxs + 2,
    borderRadius: t.radius.pill,
  },
  sm: { paddingHorizontal: t.space.xs, paddingVertical: 2 },
}));
