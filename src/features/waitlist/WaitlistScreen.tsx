import { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  Chip,
  IllustrationWaiting,
  SpecialtyIcon,
  Text,
  useToast,
} from '@/components';
import { BellRing } from '@/components/icons';
import {
  useGrantConsent,
  useHasConsent,
  useJoinWaitlist,
  useLeaveWaitlist,
  useWaitlist,
  usePractice,
  useSearchCenter,
} from '@/data/hooks';
import { useRepository } from '@/data/DataProvider';
import { ALARM_DAYS, HEALTH_CONSENT_VERSION, isAppError, type AlarmDays } from '@/data/repository';
import { makeStyles } from '@/design/theme';
import { SPECIALTIES } from '@/domain/seed/catalog';
import { ConsentCheckbox } from '@/features/booking/ConsentCheckbox';
import { openPlans } from '@/features/plans/openPlans';
import { usePlan } from '@/features/plans/usePlan';
import { useT } from '@/i18n/useT';
import { haptics } from '@/lib/haptics';
import {
  getPushToken,
  notificationPermission,
  requestNotificationPermission,
} from '@/lib/notifications';
import { usePreferences } from '@/state/preferences';
import { useSearchFilters } from '@/state/searchFilters';

const DISTANCES = [5, 10, 25, 50] as const;

/**
 * Termin-Alarm (Feature 1): Fachrichtung oder Praxis, Zeitraum (24 Std. bis 14 Tage) und
 * Umkreis wählen. Wird ein passender Slot frei, bekommt die erste Person (FIFO) eine
 * Push-Nachricht; ein Tipp öffnet das Angebot, der Slot ist 10 Minuten reserviert und mit
 * einem weiteren Tipp gebucht (Direktbuchung, `/offer/[id]`).
 * Nutzen: Niemand muss mehr stündlich nachsehen – der Termin kommt zu dir.
 * Push-Erlaubnis wird genau hier – im Moment des Nutzens – angefragt.
 * Route-Parameter: `days` (1/3/7/14) und `specialtyId` als Voreinstellung.
 */
export function WaitlistScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t, language } = useT();
  const toast = useToast();
  const repo = useRepository();
  const params = useLocalSearchParams<{
    practiceId: string;
    days?: string;
    specialtyId?: string;
  }>();
  const practiceId = params.practiceId;
  const presetDays = ALARM_DAYS.find((d) => String(d) === params.days);
  const presetSpecialty = SPECIALTIES.find((sp) => String(sp.id) === params.specialtyId)?.id;
  const isAny = practiceId === 'any';
  const practice = usePractice(isAny ? undefined : practiceId);
  const center = useSearchCenter();
  const favorites = usePreferences((s) => s.favoriteSpecialtyIds);
  const formal = usePreferences((s) => s.formalAddress);
  const filterSpecialties = useSearchFilters((s) => s.specialtyIds);
  const hasConsent = useHasConsent('health_data', HEALTH_CONSENT_VERSION);
  const grant = useGrantConsent();
  const join = useJoinWaitlist();
  const leave = useLeaveWaitlist();
  const waitlist = useWaitlist();
  const { limits, isLoading: planLoading } = usePlan();

  const defaultSpecialty =
    presetSpecialty ??
    practice.data?.practice.specialtyIds[0] ??
    filterSpecialties[0] ??
    favorites[0] ??
    1;
  const [mode, setMode] = useState<'practice' | 'specialty'>(isAny ? 'specialty' : 'practice');
  const [specialtyId, setSpecialtyId] = useState<number>(defaultSpecialty);
  const [days, setDays] = useState<AlarmDays>(presetDays ?? 7);
  const [maxKm, setMaxKm] = useState<number>(10);
  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [askPush, setAskPush] = useState(false);
  // Grenze der Stufe erreicht: Hinweis statt Fehlermeldung (Abo-Konzept, Abschnitt 5)
  const [limitReached, setLimitReached] = useState(false);
  const active = (waitlist.data ?? []).filter((w) => w.status === 'active');

  async function registerPush() {
    const granted = await requestNotificationPermission();
    if (!granted) {
      toast.show(t('waitlist.pushDenied'), 'info');
      return;
    }
    const token = await getPushToken();
    if (token && Platform.OS !== 'web') {
      await repo
        .registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android', language, formal)
        .catch(() => undefined);
    }
  }

  async function submit(options: { replaceOldest?: boolean } = {}) {
    setShowErrors(true);
    if (!hasConsent && !consent) return haptics.warning();
    if (!center.center) return;
    // Vorprüfung nur mit bekannter Stufe – sonst entscheidet der Server (plan_limit)
    if (!options.replaceOldest && !planLoading && active.length >= limits.activeAlarms) {
      setLimitReached(true);
      return;
    }
    try {
      if (options.replaceOldest) {
        // Ältesten Alarm beenden – ein Platz frei, keine Bevorzugung
        const oldest = [...active].sort(
          (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
        )[0];
        if (oldest) await leave.mutateAsync(oldest.id);
        setLimitReached(false);
      }
      if (!hasConsent)
        await grant.mutateAsync({ type: 'health_data', version: HEALTH_CONSENT_VERSION });
      await join.mutateAsync({
        input: {
          target:
            mode === 'practice' && !isAny
              ? { kind: 'practice', practiceId: practiceId! }
              : { kind: 'specialty', specialtyId, center: center.center },
          days,
          maxDistanceKm: maxKm,
        },
        center: center.center,
      });
      toast.show(t('waitlist.joined'), 'success');
      if ((await notificationPermission()) !== 'granted') {
        setAskPush(true);
        return;
      }
      void registerPush();
      router.back();
    } catch (e) {
      if (isAppError(e, 'plan_limit')) {
        setLimitReached(true);
        return;
      }
      toast.show(
        isAppError(e, 'rate_limited') ? t('errors.rateLimited') : t('errors.generic'),
        'error',
      );
    }
  }

  if (askPush) {
    return (
      <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]} testID="push-preprompt">
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.center}>
            <IllustrationWaiting size={150} />
          </View>
          <Text variant="h2" align="center">
            {t('waitlist.pushTitle')}
          </Text>
          <Text variant="body" color="textSecondary" align="center">
            {t('waitlist.pushBody')}
          </Text>
        </ScrollView>
        <View style={styles.footerCol}>
          <Button
            label={t('waitlist.pushAllow')}
            icon={BellRing}
            onPress={async () => {
              await registerPush();
              router.back();
            }}
            testID="allow-push"
          />
          <Button
            variant="text"
            label={t('waitlist.pushLater')}
            onPress={() => router.back()}
            testID="push-later"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="waitlist-sheet">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <IllustrationWaiting size={72} />
          <View style={styles.flex}>
            <Text variant="h2">{t('waitlist.title')}</Text>
          </View>
        </View>
        <Text variant="body" color="textSecondary">
          {t('waitlist.body')}
        </Text>

        <View style={styles.section}>
          <Text variant="h3">{t('waitlist.target')}</Text>
          <View style={styles.wrap} accessibilityRole="radiogroup">
            {!isAny ? (
              <Chip
                role="radio"
                label={practice.data?.practice.name ?? t('waitlist.targetPractice')}
                selected={mode === 'practice'}
                onPress={() => setMode('practice')}
              />
            ) : null}
            <Chip
              role="radio"
              label={t('waitlist.targetSpecialty', {
                specialty: t(
                  `specialtyShort.${SPECIALTIES.find((s) => s.id === specialtyId)?.slug ?? 'allgemeinmedizin'}`,
                ),
              })}
              selected={mode === 'specialty'}
              onPress={() => setMode('specialty')}
            />
          </View>
          {mode === 'specialty' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
            >
              {SPECIALTIES.map((s) => (
                <Chip
                  key={s.id}
                  role="radio"
                  label={t(`specialtyShort.${s.slug}`)}
                  icon={(p) => <SpecialtyIcon slug={s.slug} {...p} />}
                  selected={specialtyId === s.id}
                  onPress={() => setSpecialtyId(s.id)}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text variant="h3">{t('waitlist.window')}</Text>
          <View style={styles.wrap} accessibilityRole="radiogroup">
            {ALARM_DAYS.map((d) => {
              // Lange Laufzeiten (30/60 Tage) mit Plus – sichtbar, aber ehrlich gekennzeichnet
              const included = limits.alarmDays.includes(d);
              return (
                <Chip
                  key={d}
                  role="radio"
                  label={
                    included
                      ? t(`waitlist.window${d}`)
                      : `${t(`waitlist.window${d}`)} · ${t('plans.badge')}`
                  }
                  selected={days === d}
                  onPress={() => (included ? setDays(d) : openPlans('longAlarms'))}
                  testID={`alarm-days-${d}`}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="h3">{t('waitlist.maxDistance')}</Text>
          <View style={styles.wrap} accessibilityRole="radiogroup">
            {DISTANCES.map((km) => (
              <Chip
                key={km}
                role="radio"
                label={t('filters.radiusValue', { value: km })}
                selected={maxKm === km}
                onPress={() => setMaxKm(km)}
              />
            ))}
          </View>
        </View>

        {!hasConsent ? (
          <ConsentCheckbox checked={consent} onChange={setConsent} showError={showErrors} />
        ) : null}
        {repo.mode === 'memory' ? (
          <Card tone="muted">
            <Text variant="small" color="textSecondary">
              {t('app.demoNotice')}
            </Text>
          </Card>
        ) : null}
      </ScrollView>
      {limitReached ? (
        <View
          style={[styles.footer, styles.footerCol, { paddingBottom: Math.max(insets.bottom, 16) }]}
          testID="alarm-limit"
        >
          <Text variant="h3">{t('plans.limitTitle')}</Text>
          <Text variant="small" color="textSecondary">
            {t('plans.limitBody')}
          </Text>
          <Button
            variant="secondary"
            label={t('plans.replaceAlarm')}
            loading={leave.isPending || join.isPending}
            onPress={() => void submit({ replaceOldest: true })}
            testID="alarm-replace"
          />
          <Button
            variant="secondary"
            label={t('plans.seePlus')}
            onPress={() => openPlans('alarms')}
            testID="alarm-see-plus"
          />
          <Button variant="text" label={t('plans.notNow')} onPress={() => setLimitReached(false)} />
        </View>
      ) : (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Button
            label={t('waitlist.join')}
            icon={BellRing}
            loading={join.isPending || grant.isPending}
            onPress={() => void submit()}
            testID="join-waitlist"
          />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.surface },
  content: { padding: t.space.lg, gap: t.space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  section: { gap: t.space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs },
  hList: { gap: t.space.xs, paddingRight: t.space.md },
  footer: {
    paddingTop: t.space.sm,
    paddingHorizontal: t.space.lg,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  footerCol: { paddingHorizontal: t.space.lg, gap: t.space.xs },
}));
