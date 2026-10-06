import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, useReducedMotion } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  Chip,
  DemoBadge,
  PressableScale,
  ProgressDots,
  SlotChip,
  Text,
  useToast,
} from '@/components';
import { CalendarCheck, Clock, MapPin, Stethoscope, Timer, Video, X } from '@/components/icons';
import {
  useBookSlot,
  useContact,
  useGrantConsent,
  useHasConsent,
  usePractice,
  usePracticeSlots,
  useSession,
} from '@/data/hooks';
import { useRepository } from '@/data/DataProvider';
import { HEALTH_CONSENT_VERSION, isAppError } from '@/data/repository';
import { makeStyles, useTheme } from '@/design/theme';
import { isSlotBookable } from '@/domain/availability/status';
import { formatBerlinTime } from '@/domain/time/berlin';
import { REASON_CATEGORIES, type BookingContact, type ReasonCategory } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { formatCountdown, formatLongDate, formatSlotWhen } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { notificationPermission, scheduleReminders } from '@/lib/notifications';
import { useNow } from '@/lib/useNow';
import { usePreferences } from '@/state/preferences';

import { ConsentCheckbox } from './ConsentCheckbox';
import { ContactForm } from './ContactForm';
import { EmailVerification } from './EmailVerification';
import { PatientPicker } from './PatientPicker';
import { useSlotHold } from './useBookingFlow';

const STEPS = 4;

/**
 * Buchung als Sheet in höchstens 4 Schritten: Termin → für wen → Anlass → Bestätigen.
 * Der Slot ist währenddessen 5 Minuten reserviert.
 */
export function BookingScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const toast = useToast();
  const reduce = useReducedMotion();
  const repo = useRepository();
  const now = useNow(1000);
  const { slotId, practiceId } = useLocalSearchParams<{ slotId: string; practiceId?: string }>();
  const hold = useSlotHold(slotId);
  const practice = usePractice(practiceId);
  const slots = usePracticeSlots(practiceId);
  const contact = useContact();
  const session = useSession();
  const hasConsent = useHasConsent('health_data', HEALTH_CONSENT_VERSION);
  const grant = useGrantConsent();
  const book = useBookSlot();
  const remindersEnabled = usePreferences((s) => s.remindersEnabled);

  const [step, setStep] = useState(0);
  const [dependentId, setDependentId] = useState<string | null>(null);
  const [reason, setReason] = useState<ReasonCategory | null>(null);
  const [contactValue, setContactValue] = useState<BookingContact | null>(null);
  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const slot = slots.data?.find((s) => s.id === slotId);
  const doctor = practice.data?.doctors.find((d) => d.id === slot?.doctorId);
  const msLeft = hold.heldUntil ? Date.parse(hold.heldUntil) - now.getTime() : null;
  const expired = msLeft !== null && msLeft <= 0;
  // Screenreader: einmalig ankündigen, wenn die Reservierung bald endet (WCAG 2.2.1)
  const lastMinute = msLeft !== null && msLeft > 0 && msLeft <= 60_000;
  const announced = useRef(false);
  useEffect(() => {
    if (lastMinute && !announced.current) {
      announced.current = true;
      AccessibilityInfo.announceForAccessibility(t('booking.holdEndingA11y'));
    }
  }, [lastMinute, t]);
  const needsVerification = repo.mode === 'supabase' && (session.data?.isAnonymous ?? true);
  const alternatives = useMemo(
    () => (slots.data ?? []).filter((s) => s.id !== slotId && isSlotBookable(s, now)).slice(0, 6),
    [slots.data, slotId, now],
  );

  const close = () => router.back();
  const choose = (id: string) =>
    router.replace({
      pathname: '/booking/[slotId]',
      params: { slotId: id, practiceId: practiceId ?? '' },
    });
  const next = () => {
    haptics.light();
    setStep((s) => Math.min(STEPS - 1, s + 1));
  };

  async function submit() {
    setShowErrors(true);
    setSubmitError(null);
    if (!contactValue) return haptics.warning();
    if (!hasConsent && !consent) return haptics.warning();
    if (needsVerification) {
      setSubmitError(t('booking.errors.verificationRequired'));
      return haptics.warning();
    }
    try {
      if (!hasConsent)
        await grant.mutateAsync({ type: 'health_data', version: HEALTH_CONSENT_VERSION });
      const appointment = await book.mutateAsync({
        slotId: slotId!,
        idempotencyKey: hold.idempotencyKey,
        dependentId,
        reasonCategory: reason,
        contact: contactValue,
        consentVersion: HEALTH_CONSENT_VERSION,
      });
      hold.markBooked();
      if (remindersEnabled && (await notificationPermission()) === 'granted') {
        void scheduleReminders(appointment, t, locale);
      }
      router.replace({ pathname: '/booking/success', params: { appointmentId: appointment.id } });
    } catch (error) {
      const code = isAppError(error) ? error.code : 'unknown';
      const message =
        code === 'slot_taken'
          ? t('booking.errors.slotTaken')
          : code === 'hold_expired'
            ? t('booking.errors.holdExpired')
            : code === 'consent_missing'
              ? t('booking.errors.consentMissing')
              : code === 'verification_required'
                ? t('booking.errors.verificationRequired')
                : code === 'network'
                  ? t('errors.network')
                  : t('errors.generic');
      setSubmitError(message);
      toast.show(message, 'error');
    }
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text variant="h2" style={styles.flex}>
          {t('booking.title')}
        </Text>
        <PressableScale
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={styles.close}
        >
          <X size={22} color={theme.colors.textPrimary} strokeWidth={2.25} />
        </PressableScale>
      </View>
      <View style={styles.headerRow}>
        <ProgressDots total={STEPS} current={step} />
        <Text variant="smallStrong" color="textSecondary">
          {t(`booking.steps.${(['confirm', 'patient', 'reason', 'summary'] as const)[step]!}`)}
        </Text>
      </View>
      {hold.heldUntil && !expired && msLeft !== null ? (
        <View
          style={styles.holdPill}
          accessible
          accessibilityLabel={t('booking.holdRemainingA11y', {
            minutes: Math.ceil(msLeft / 60000),
          })}
          testID="hold-countdown"
        >
          <Timer size={14} color={theme.colors.primary} strokeWidth={2.25} />
          <Text variant="caption" color="primary">
            {t('booking.holdRemaining', { time: formatCountdown(msLeft) })}
          </Text>
        </View>
      ) : null}
    </View>
  );

  // Fehler beim Reservieren: Termin gerade vergeben → direkt Alternativen anbieten
  if (hold.error || expired) {
    const message =
      expired || hold.error === 'hold_expired'
        ? t('booking.errors.holdExpired')
        : hold.error === 'slot_taken'
          ? t('booking.errors.slotTaken')
          : t('errors.generic');
    return (
      <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <Card tone="muted" accessibilityRole="alert">
            <Text variant="bodyStrong">{message}</Text>
          </Card>
          {expired ||
          hold.error === 'hold_expired' ||
          hold.error === 'network' ||
          hold.error === 'unknown' ? (
            <Button label={t('common.retry')} onPress={() => void hold.retry()} />
          ) : null}
          {alternatives.length ? (
            <View style={styles.wrap} accessibilityRole="radiogroup">
              {alternatives.map((s) => (
                <SlotChip
                  key={s.id}
                  time={formatSlotWhen(s.startsAt, now, t, locale)}
                  onPress={() => choose(s.id)}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  const entering = reduce ? FadeIn : FadeInRight.springify().damping(18).stiffness(220);

  return (
    <View style={styles.root} testID="booking-sheet">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {header}
        <Animated.View key={step} entering={entering} style={styles.step}>
          {step === 0 ? (
            <>
              <Card tone="primary" testID="booking-slot-card">
                {slot && practice.data ? (
                  <View style={styles.summary}>
                    <Text variant="h3">{formatLongDate(slot.startsAt, locale)}</Text>
                    <SummaryRow
                      icon={Clock}
                      text={t('time.timeOClock', { time: formatBerlinTime(slot.startsAt, locale) })}
                    />
                    <SummaryRow
                      icon={Stethoscope}
                      text={`${practice.data.practice.name}${doctor ? ` · ${doctor.name}` : ''}`}
                    />
                    <SummaryRow
                      icon={MapPin}
                      text={`${practice.data.practice.address.street}, ${practice.data.practice.address.postalCode} ${practice.data.practice.address.city}`}
                    />
                    {slot.visitType === 'video' ? (
                      <SummaryRow icon={Video} text={t('practice.videoSlot')} />
                    ) : null}
                    {practice.data.practice.isDemo ? <DemoBadge /> : null}
                  </View>
                ) : (
                  <Text variant="body">{t('booking.holding')}</Text>
                )}
              </Card>
              <Text variant="small" color="textSecondary">
                {t('booking.holdNotice', { minutes: 5 })}
              </Text>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text variant="h3">{t('booking.patientTitle')}</Text>
              <PatientPicker value={dependentId} onChange={setDependentId} />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text variant="h3">{t('booking.reasonTitle')}</Text>
              <Text variant="small" color="textSecondary">
                {t('booking.reasonHint')}
              </Text>
              <View
                style={styles.wrap}
                accessibilityRole="radiogroup"
                accessibilityLabel={t('booking.reasonTitle')}
              >
                <Chip
                  role="radio"
                  label={t('booking.reasonNone')}
                  selected={reason === null}
                  onPress={() => setReason(null)}
                />
                {REASON_CATEGORIES.map((r) => (
                  <Chip
                    key={r}
                    role="radio"
                    label={t(`reason.${r}`)}
                    selected={reason === r}
                    onPress={() => setReason(r)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text variant="h3">{t('booking.summaryTitle')}</Text>
              {slot && practice.data ? (
                <Card tone="muted">
                  <View style={styles.summary}>
                    <SummaryRow
                      icon={CalendarCheck}
                      text={`${formatLongDate(slot.startsAt, locale)}, ${t('time.timeOClock', { time: formatBerlinTime(slot.startsAt, locale) })}`}
                    />
                    <SummaryRow
                      icon={Stethoscope}
                      text={`${practice.data.practice.name}${doctor ? ` · ${doctor.name}` : ''}`}
                    />
                    {reason ? <SummaryRow icon={Clock} text={t(`reason.${reason}`)} /> : null}
                  </View>
                </Card>
              ) : null}
              <Text variant="h3">{t('booking.contactTitle')}</Text>
              <ContactForm defaultValues={contact.data} onChange={setContactValue} />
              {repo.mode === 'supabase' ? (
                <EmailVerification
                  verified={!needsVerification}
                  email={session.data?.email ?? null}
                />
              ) : null}
              {!hasConsent ? (
                <ConsentCheckbox checked={consent} onChange={setConsent} showError={showErrors} />
              ) : null}
              {submitError ? (
                <Text
                  variant="small"
                  color="statusBooked"
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                >
                  {submitError}
                </Text>
              ) : null}
            </>
          ) : null}
        </Animated.View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {step > 0 ? (
          <Button variant="text" label={t('common.back')} onPress={() => setStep((s) => s - 1)} />
        ) : null}
        <Button
          style={styles.flex}
          label={step === STEPS - 1 ? t('booking.submit') : t('common.next')}
          loading={step === STEPS - 1 && (book.isPending || grant.isPending)}
          disabled={step === 0 && (hold.holding || !hold.heldUntil)}
          onPress={step === STEPS - 1 ? () => void submit() : next}
          testID={step === STEPS - 1 ? 'booking-submit' : 'booking-next'}
        />
      </View>
    </View>
  );
}

function SummaryRow({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.summaryRow}>
      <Icon size={16} color={theme.colors.primary} strokeWidth={2.25} />
      <Text variant="body" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.surface },
  content: { padding: t.space.lg, gap: t.space.lg, paddingBottom: t.space.xxxl },
  header: { gap: t.space.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.sm,
  },
  close: {
    width: t.layout.touchTarget,
    height: t.layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xxs,
    alignSelf: 'flex-start',
    backgroundColor: t.colors.primarySoft,
    paddingHorizontal: t.space.sm,
    paddingVertical: t.space.xxs,
    borderRadius: t.radius.pill,
  },
  step: { gap: t.space.md },
  summary: { gap: t.space.xs },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs },
  flex: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    paddingTop: t.space.sm,
    paddingHorizontal: t.space.lg,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
}));
