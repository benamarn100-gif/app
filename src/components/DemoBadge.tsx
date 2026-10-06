import { View } from 'react-native';
import { FlaskConical } from 'lucide-react-native';

import { makeStyles, useTheme } from '@/design/theme';
import { useT } from '@/i18n/useT';

import { Text } from './Text';

/** Kennzeichnung erfundener Demo-Daten (Vorgabe: Demo-Daten klar markieren). */
export function DemoBadge() {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  return (
    <View style={styles.badge} accessible accessibilityLabel={t('app.demoBadgeA11y')}>
      <FlaskConical size={12} color={theme.colors.textSecondary} strokeWidth={2.25} />
      <Text variant="caption" color="textSecondary">
        {t('app.demoBadge')}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: t.space.xs,
    paddingVertical: 2,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceMuted,
    alignSelf: 'flex-start',
  },
}));
