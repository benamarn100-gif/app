import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { brand } from '@/config/brand';
import { makeStyles, useTheme } from '@/design/theme';
import { useT } from '@/i18n/useT';
import { useIsOnline } from '@/lib/network';

import { ChevronRight, Phone, Siren, WifiOff } from './icons';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/**
 * Dezente Notfall-Leiste: „Akut? 116117 · Notfall 112“ – beide Nummern direkt anrufbar,
 * „Mehr Hilfe“ öffnet die Notfall-Seite (Notdienst-Apotheke, Krisentelefon).
 */
export function EmergencyBar() {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const { onCallService, emergency } = brand.emergency;
  return (
    <View style={styles.bar} testID="emergency-bar">
      <Siren size={18} color={theme.colors.statusBooked} strokeWidth={2} />
      <Text variant="small" color="textSecondary" style={styles.label}>
        {t('emergency.acute')}
      </Text>
      <PressableScale
        onPress={() => void Linking.openURL(`tel:${onCallService}`)}
        accessibilityRole="button"
        accessibilityLabel={t('emergency.onCallA11y', { number: onCallService })}
        style={styles.number}
        testID="call-116117"
      >
        <Phone size={14} color={theme.colors.primary} strokeWidth={2.25} />
        <Text variant="smallStrong" color="primary">
          {onCallService}
        </Text>
      </PressableScale>
      <Text variant="small" color="textSecondary">
        {t('emergency.emergencyLabel')}
      </Text>
      <PressableScale
        onPress={() => void Linking.openURL(`tel:${emergency}`)}
        accessibilityRole="button"
        accessibilityLabel={t('emergency.emergencyA11y', { number: emergency })}
        style={styles.number}
        testID="call-112"
      >
        <Phone size={14} color={theme.colors.statusBooked} strokeWidth={2.25} />
        <Text variant="smallStrong" color="statusBooked">
          {emergency}
        </Text>
      </PressableScale>
      <PressableScale
        onPress={() => router.push('/emergency')}
        accessibilityRole="link"
        accessibilityLabel={t('emergency.moreA11y')}
        style={styles.number}
        testID="emergency-more"
      >
        <Text variant="smallStrong" color="primary">
          {t('emergency.more')}
        </Text>
        <ChevronRight size={14} color={theme.colors.primary} strokeWidth={2.25} />
      </PressableScale>
    </View>
  );
}

/** Offline-Hinweis: zeigt, dass zuletzt geladene Ergebnisse angezeigt werden. */
export function OfflineBanner() {
  const online = useIsOnline();
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  if (online) return null;
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      style={styles.offline}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID="offline-banner"
    >
      <WifiOff size={16} color={theme.colors.textPrimary} strokeWidth={2} />
      <Text variant="smallStrong" style={styles.label}>
        {t('offline.banner')}
      </Text>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: t.space.xs,
    paddingVertical: t.space.xxs,
    paddingHorizontal: t.space.md,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceMuted,
  },
  label: { flexShrink: 1 },
  number: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: t.layout.touchTarget,
    paddingHorizontal: t.space.xs,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    paddingVertical: t.space.xs,
    paddingHorizontal: t.space.md,
    backgroundColor: t.colors.statusFewSoft,
    borderRadius: t.radius.md,
  },
}));
