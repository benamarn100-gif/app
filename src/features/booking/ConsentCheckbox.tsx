import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import { router } from 'expo-router';

import { Button, PressableScale, Text } from '@/components';
import { makeStyles, useTheme } from '@/design/theme';
import { useT } from '@/i18n/useT';
import { haptics } from '@/lib/haptics';

type Props = { checked: boolean; onChange: (checked: boolean) => void; showError?: boolean };

/**
 * Ausdrückliche, separate, NICHT vorangekreuzte Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO.
 * Versioniert gespeichert, im Datenschutz-Center widerrufbar.
 */
export function ConsentCheckbox({ checked, onChange, showError }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  return (
    <View style={styles.container}>
      <Text variant="h3">{t('booking.consentTitle')}</Text>
      <PressableScale
        onPress={() => {
          haptics.selection();
          onChange(!checked);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={t('booking.consentText')}
        style={[styles.row, showError && !checked && styles.error]}
        scaleTo={0.99}
        testID="consent-checkbox"
      >
        <View
          style={[
            styles.box,
            checked && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
          ]}
        >
          {checked ? <Check size={18} color={theme.colors.textOnPrimary} strokeWidth={3} /> : null}
        </View>
        <Text variant="small" style={styles.text}>
          {t('booking.consentText')}
        </Text>
      </PressableScale>
      {showError && !checked ? (
        <Text
          variant="small"
          color="statusBooked"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          {t('booking.consentRequired')}
        </Text>
      ) : null}
      <Button
        variant="text"
        label={t('booking.consentMore')}
        onPress={() => router.push('/settings/legal/privacy')}
        style={styles.more}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: { gap: t.space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space.sm,
    padding: t.space.sm,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceMuted,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  error: { borderColor: t.colors.statusBooked },
  box: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  text: { flex: 1 },
  more: { alignSelf: 'flex-start' },
}));
