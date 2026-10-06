import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  Button,
  Chip,
  IllustrationWelcome,
  OrganicBackground,
  ProgressDots,
  SpecialtyIcon,
  Text,
} from '@/components';
import { makeStyles } from '@/design/theme';
import { SPECIALTIES } from '@/domain/seed/catalog';
import { AGE_GROUPS, type AgeGroup } from '@/domain/types';
import { LocationPicker } from '@/features/location/LocationPicker';
import { useT } from '@/i18n/useT';
import { useMarkInteractive } from '@/lib/startup';
import { usePreferences } from '@/state/preferences';

const CHILD_GROUPS: AgeGroup[] = ['child_0_5', 'child_6_12', 'teen_13_17'];
const ADULT_GROUPS: AgeGroup[] = AGE_GROUPS.filter((g) => !CHILD_GROUPS.includes(g));
const STEPS = 3;

/**
 * Start + Onboarding in 3 überspringbaren Schritten: Standort, für wen, Interessen.
 * Push-Erlaubnis wird hier bewusst NICHT angefragt (erst bei der Warteliste).
 */
export function OnboardingScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const reduce = useReducedMotion();
  const prefs = usePreferences();
  const [step, setStep] = useState<-1 | 0 | 1 | 2>(-1);
  useMarkInteractive('onboarding', true);

  const finish = () => {
    prefs.completeOnboarding();
    router.replace('/(tabs)');
  };
  const next = () => (step >= STEPS - 1 ? finish() : setStep((s) => (s + 1) as 0 | 1 | 2));
  const entering = reduce ? FadeIn : FadeInRight.springify().damping(18).stiffness(220);

  if (step === -1) {
    return (
      <View
        style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}
        testID="onboarding-welcome"
      >
        <OrganicBackground />
        <ScrollView contentContainerStyle={styles.welcome}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.center}>
            <IllustrationWelcome size={200} />
          </Animated.View>
          <View style={styles.texts}>
            <Text variant="display" align="center">
              {t('onboarding.welcome.title')}
            </Text>
            <Text variant="body" color="textSecondary" align="center">
              {t('onboarding.welcome.body')}
            </Text>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label={t('onboarding.welcome.start')}
            onPress={() => setStep(0)}
            testID="onboarding-start"
          />
          <Button
            variant="text"
            label={t('onboarding.welcome.skipAll')}
            onPress={finish}
            testID="onboarding-skip-all"
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}
      testID={`onboarding-step-${step}`}
    >
      <View style={styles.topBar}>
        <ProgressDots total={STEPS} current={step} />
        <Button variant="text" label={t('common.skip')} onPress={next} testID="onboarding-skip" />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Animated.View
          key={step}
          entering={entering}
          exiting={FadeOut.duration(120)}
          style={styles.stepBody}
        >
          {step === 0 ? (
            <>
              <Text variant="h1">{t('onboarding.location.title')}</Text>
              <Text variant="body" color="textSecondary">
                {t('onboarding.location.body')}
              </Text>
              <LocationPicker onDone={next} />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text variant="h1">{t('onboarding.forWhom.title')}</Text>
              <View style={styles.row} accessibilityRole="radiogroup">
                <Chip
                  role="radio"
                  size="lg"
                  label={t('onboarding.forWhom.self')}
                  selected={prefs.forWhom === 'self'}
                  onPress={() => prefs.set({ forWhom: 'self', ageGroup: null })}
                />
                <Chip
                  role="radio"
                  size="lg"
                  label={t('onboarding.forWhom.child')}
                  selected={prefs.forWhom === 'child'}
                  onPress={() => prefs.set({ forWhom: 'child', ageGroup: null })}
                />
              </View>
              <Text variant="h3">{t('onboarding.forWhom.ageGroup')}</Text>
              <View
                style={styles.wrap}
                accessibilityRole="radiogroup"
                accessibilityLabel={t('onboarding.forWhom.ageGroup')}
              >
                {(prefs.forWhom === 'child' ? CHILD_GROUPS : ADULT_GROUPS).map((group) => (
                  <Chip
                    key={group}
                    role="radio"
                    label={t(`ageGroup.${group}`)}
                    selected={prefs.ageGroup === group}
                    onPress={() => prefs.set({ ageGroup: group })}
                  />
                ))}
              </View>
              <Text variant="small" color="textSecondary">
                {t('onboarding.forWhom.ageHint')}
              </Text>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text variant="h1">{t('onboarding.interests.title')}</Text>
              <Text variant="body" color="textSecondary">
                {t('onboarding.interests.body')}
              </Text>
              <View style={styles.wrap}>
                {SPECIALTIES.map((s) => (
                  <Chip
                    key={s.id}
                    label={t(`specialty.${s.slug}`)}
                    icon={(p) => <SpecialtyIcon slug={s.slug} {...p} />}
                    selected={prefs.favoriteSpecialtyIds.includes(s.id)}
                    onPress={() => prefs.toggleFavoriteSpecialty(s.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </Animated.View>
      </ScrollView>
      {step > 0 ? (
        <View style={styles.footer}>
          <Button
            label={step === STEPS - 1 ? t('onboarding.interests.finish') : t('common.next')}
            onPress={next}
            testID="onboarding-next"
          />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  welcome: { flexGrow: 1, justifyContent: 'center', padding: t.space.xl, gap: t.space.xxl },
  center: { alignItems: 'center' },
  texts: { gap: t.space.sm, maxWidth: 520, alignSelf: 'center' },
  footer: {
    paddingHorizontal: t.space.xl,
    gap: t.space.xs,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.space.xl,
  },
  body: { flexGrow: 1, padding: t.space.xl },
  stepBody: { gap: t.space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', gap: t.space.sm, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs },
}));
