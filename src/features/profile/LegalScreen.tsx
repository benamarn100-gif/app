import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { Card, EmergencyBar, Text } from '@/components';
import { TriangleAlert } from '@/components/icons';
import { brand } from '@/config/brand';
import { makeStyles, useTheme } from '@/design/theme';
import { useT, type TFn } from '@/i18n/useT';

type Page = 'imprint' | 'privacy' | 'terms' | 'licenses' | 'accessibility' | 'help';

const OSS = [
  'Expo, React Native, React (MIT)',
  'Expo Router (MIT)',
  'React Native Reanimated, Gesture Handler (MIT)',
  'MapLibre React Native (BSD-2-Clause)',
  'FlashList (MIT)',
  '@gorhom/bottom-sheet (MIT)',
  'TanStack Query (MIT)',
  'Zustand (MIT)',
  'react-hook-form (MIT), zod (MIT)',
  'i18next, react-i18next (MIT)',
  'date-fns, @date-fns/tz (MIT)',
  'Supabase JS (MIT)',
];

function title(page: Page, t: TFn) {
  return {
    imprint: t('profile.imprint'),
    privacy: t('profile.privacyPolicy'),
    terms: t('profile.terms'),
    licenses: t('profile.licenses'),
    accessibility: t('profile.accessibilityStatement'),
    help: t('profile.help'),
  }[page];
}

/** Rechtstexte: deutlich markierte Platzhalter („vor Launch anwaltlich prüfen“). */
export function LegalScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const { page = 'imprint' } = useLocalSearchParams<{ page: Page }>();
  const isPlaceholder = page !== 'licenses' && page !== 'help';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: title(page, t) }} />
      {isPlaceholder ? (
        <Card tone="accent" accessibilityRole="alert">
          <View style={styles.row}>
            <TriangleAlert size={20} color={theme.colors.textPrimary} strokeWidth={2.25} />
            <Text variant="bodyStrong" style={styles.flex}>
              {t('legal.placeholder')}
            </Text>
          </View>
        </Card>
      ) : null}
      {page === 'imprint' ? (
        <>
          <Text variant="body">{brand.publisher}</Text>
          <Text variant="body">{t('legal.imprintBody')}</Text>
        </>
      ) : null}
      {page === 'privacy' ? <Text variant="body">{t('legal.privacyBody')}</Text> : null}
      {page === 'terms' ? <Text variant="body">{t('legal.termsBody')}</Text> : null}
      {page === 'accessibility' ? <Text variant="body">{t('legal.accessibilityBody')}</Text> : null}
      {page === 'help' ? (
        <>
          <Text variant="body">{t('legal.helpBody')}</Text>
          <EmergencyBar />
          <Text variant="small" color="textSecondary">
            {t('emergency.disclaimer')}
          </Text>
        </>
      ) : null}
      {page === 'licenses' ? (
        <>
          <Text variant="body">{t('legal.licensesIntro')}</Text>
          <Text variant="body">{t('legal.osmAttribution')}</Text>
          <Text variant="body">{t('legal.fontsAttribution')}</Text>
          <Text variant="body">{t('legal.iconsAttribution')}</Text>
          {OSS.map((line) => (
            <Text key={line} variant="small" color="textSecondary">
              {line}
            </Text>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: { padding: t.layout.screenPadding, gap: t.space.md, paddingBottom: t.space.huge },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  flex: { flex: 1 },
}));
