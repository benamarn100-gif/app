import { ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Chip, Divider, ListRow, SectionHeader, SegmentedControl, Text } from '@/components';
import {
  Accessibility,
  Bell,
  BookOpen,
  CircleUserRound,
  FileText,
  HeartHandshake,
  Info,
  Languages,
  LayoutTemplate,
  MapPin,
  Palette,
  RotateCcw,
  Scale,
  ShieldCheck,
  Smartphone,
  Users,
} from '@/components/icons';
import { useSearchCenter, useSession } from '@/data/hooks';
import { useRepository } from '@/data/DataProvider';
import { makeStyles } from '@/design/theme';
import type { ThemePreference } from '@/design/theme';
import type { LanguagePreference } from '@/i18n';
import { useT } from '@/i18n/useT';
import { usePreferences } from '@/state/preferences';
import { RADIUS_STEPS } from '@/state/searchFilters';

export function ProfileScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const repo = useRepository();
  const session = useSession();
  const prefs = usePreferences();
  const center = useSearchCenter();
  const version = Constants.expoConfig?.version ?? '0.1.0';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 96 },
      ]}
      testID="profile-screen"
    >
      <Text variant="h1">{t('profile.title')}</Text>

      <Card tone="muted">
        <View style={styles.account}>
          <CircleUserRound size={28} color={styles.icon.color} strokeWidth={2} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('profile.account')}</Text>
            <Text variant="small" color="textSecondary">
              {session.data?.email
                ? t('profile.signedInAs', { email: session.data.email })
                : t('profile.anonymous')}
            </Text>
            {repo.mode === 'memory' ? (
              <Text variant="caption" color="textSecondary">
                {t('app.demoNotice')}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeader title={t('profile.location')} />
        <Card padding="none">
          <ListRow
            icon={MapPin}
            title={t('profile.location')}
            value={center.label}
            onPress={() => router.push('/location')}
          />
        </Card>
        <Text variant="smallStrong">{t('profile.radius')}</Text>
        <View
          style={styles.wrap}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('profile.radius')}
        >
          {RADIUS_STEPS.filter((r) => r >= 2).map((r) => (
            <Chip
              key={r}
              role="radio"
              label={t('filters.radiusValue', { value: r })}
              selected={prefs.radiusKm === r}
              onPress={() => prefs.set({ radiusKm: r })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('profile.family')} />
        <Card padding="none">
          <ListRow
            icon={Users}
            title={t('profile.family')}
            subtitle={t('profile.familyHint')}
            onPress={() => router.push('/settings/family')}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('profile.notifications')} />
        <Card padding="none">
          <ListRow
            icon={Bell}
            title={t('profile.reminders')}
            switchValue={prefs.remindersEnabled}
            onSwitch={(v) => prefs.set({ remindersEnabled: v })}
          />
          <Divider inset={64} />
          <ListRow
            icon={Smartphone}
            title={t('profile.haptics')}
            switchValue={prefs.haptics}
            onSwitch={(v) => prefs.set({ haptics: v })}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('profile.appearance')} />
        <View style={styles.row}>
          <Palette size={20} color={styles.icon.color} strokeWidth={2} />
          <View style={styles.flex}>
            <SegmentedControl<ThemePreference>
              accessibilityLabel={t('profile.appearance')}
              value={prefs.theme}
              onChange={(v) => prefs.set({ theme: v })}
              options={[
                { value: 'system', label: t('profile.themeSystem') },
                { value: 'light', label: t('profile.themeLight') },
                { value: 'dark', label: t('profile.themeDark') },
              ]}
              testID="theme-toggle"
            />
          </View>
        </View>
        <Text variant="smallStrong">{t('profile.language')}</Text>
        <View style={styles.row}>
          <Languages size={20} color={styles.icon.color} strokeWidth={2} />
          <View style={styles.flex}>
            <SegmentedControl<LanguagePreference>
              accessibilityLabel={t('profile.language')}
              value={prefs.language}
              onChange={(v) => prefs.set({ language: v })}
              options={[
                { value: 'system', label: t('profile.languageSystem') },
                { value: 'de', label: 'Deutsch' },
                { value: 'en', label: 'English' },
              ]}
            />
          </View>
        </View>
        <Text variant="smallStrong">{t('profile.address')}</Text>
        <View style={styles.row}>
          <HeartHandshake size={20} color={styles.icon.color} strokeWidth={2} />
          <View style={styles.flex}>
            <SegmentedControl<'du' | 'sie'>
              accessibilityLabel={t('profile.address')}
              value={prefs.formalAddress ? 'sie' : 'du'}
              onChange={(v) => prefs.set({ formalAddress: v === 'sie' })}
              options={[
                { value: 'du', label: t('profile.addressInformal') },
                { value: 'sie', label: t('profile.addressFormal') },
              ]}
              testID="address-toggle"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('profile.privacyCenter')} />
        <Card padding="none">
          <ListRow
            icon={ShieldCheck}
            title={t('profile.privacyCenter')}
            subtitle={t('privacy.intro')}
            onPress={() => router.push('/settings/privacy')}
            testID="open-privacy"
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('profile.legal')} />
        <Card padding="none">
          <ListRow
            icon={Info}
            title={t('profile.help')}
            onPress={() => router.push('/settings/legal/help')}
          />
          <Divider inset={64} />
          <ListRow
            icon={FileText}
            title={t('profile.imprint')}
            onPress={() => router.push('/settings/legal/imprint')}
          />
          <Divider inset={64} />
          <ListRow
            icon={ShieldCheck}
            title={t('profile.privacyPolicy')}
            onPress={() => router.push('/settings/legal/privacy')}
          />
          <Divider inset={64} />
          <ListRow
            icon={Scale}
            title={t('profile.terms')}
            onPress={() => router.push('/settings/legal/terms')}
          />
          <Divider inset={64} />
          <ListRow
            icon={BookOpen}
            title={t('profile.licenses')}
            onPress={() => router.push('/settings/legal/licenses')}
          />
          <Divider inset={64} />
          <ListRow
            icon={Accessibility}
            title={t('profile.accessibilityStatement')}
            onPress={() => router.push('/settings/legal/accessibility')}
          />
        </Card>
      </View>

      {__DEV__ ? (
        <Card padding="none">
          <ListRow
            icon={LayoutTemplate}
            title={t('profile.showcase')}
            onPress={() => router.push('/dev/showcase')}
            testID="open-showcase"
          />
          <Divider inset={64} />
          <ListRow
            icon={RotateCcw}
            title={t('profile.resetOnboarding')}
            onPress={() => {
              prefs.set({ onboardingCompleted: false });
              router.replace('/onboarding');
            }}
          />
        </Card>
      ) : null}

      <Text variant="caption" color="textSecondary" align="center">
        {t('profile.version', { version })}
      </Text>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: {
    paddingHorizontal: t.layout.screenPadding,
    gap: t.space.xl,
    maxWidth: t.layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  section: { gap: t.space.sm },
  account: { flexDirection: 'row', gap: t.space.sm, alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs },
  flex: { flex: 1, gap: 2 },
  icon: { color: t.colors.primary },
}));
