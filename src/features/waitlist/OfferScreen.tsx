import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  EmptyState,
  IllustrationCalendar,
  IllustrationWaiting,
  Skeleton,
  Text,
  useToast,
} from '@/components';
import { Clock, MapPin, Stethoscope, Timer } from '@/components/icons';
import { useContact, useOffers, useRespondOffer, useSession } from '@/data/hooks';
import { useRepository } from '@/data/DataProvider';
import { HEALTH_CONSENT_VERSION, isAppError } from '@/data/repository';
import { makeStyles, useTheme } from '@/design/theme';
import { formatBerlinTime } from '@/domain/time/berlin';
import type { BookingContact } from '@/domain/types';
import { ContactForm } from '@/features/booking/ContactForm';
import { EmailVerification } from '@/features/booking/EmailVerification';
import { useT } from '@/i18n/useT';
import { formatCountdown, formatLongDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useAppointmentEffects } from '@/lib/useAppointmentEffects';
import { useNow } from '@/lib/useNow';

/** Angebot aus der Warteliste: 10 Minuten reserviert – übernehmen oder weitergeben. */
export function OfferScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const toast = useToast();
  const repo = useRepository();
  const now = useNow(1000);
  const { offerId } = useLocalSearchParams<{ offerId: string }>();
  const offers = useOffers();
  const contact = useContact();
  const session = useSession();
  const respond = useRespondOffer();
  const effects = useAppointmentEffects();
  const [contactValue, setContactValue] = useState<BookingContact | null>(null);
  const key = useMemo(() => Crypto.randomUUID(), []);
  const offer = offers.data?.find((o) => o.id === offerId);
  const msLeft = offer ? Date.parse(offer.expiresAt) - now.getTime() : 0;
  const expired = !offer || offer.status !== 'pending' || msLeft <= 0;
  const needsVerification = repo.mode === 'supabase' && (session.data?.isAnonymous ?? true);
  // Screenreader: einmalig ankündigen, wenn das Angebot bald verfällt (WCAG 2.2.1)
  const lastMinute = !expired && msLeft <= 60_000;
  const announced = useRef(false);
  useEffect(() => {
    if (lastMinute && !announced.current) {
      announced.current = true;
      AccessibilityInfo.announceForAccessibility(t('offer.endingA11y'));
    }
  }, [lastMinute, t]);

  if (offers.isLoading) {
    return (
      <View style={styles.pad}>
        <Skeleton height={200} />
      </View>
    );
  }

  if (!offer || expired) {
    return (
      <EmptyState
        illustration={<IllustrationWaiting size={150} />}
        title={offer?.status === 'accepted' ? t('booking.successTitle') : t('offer.expired')}
        primaryAction={{ label: t('common.done'), onPress: () => router.back() }}
        testID="offer-expired"
      />
    );
  }

  async function accept() {
    if (!contactValue || needsVerification) return haptics.warning();
    try {
      const appointment = await respond.mutateAsync({
        offerId: offer!.id,
        accept: true,
        booking: {
          idempotencyKey: key,
          dependentId: null,
          reasonCategory: null,
          contact: contactValue,
          consentVersion: HEALTH_CONSENT_VERSION,
        },
      });
      if (appointment && offer) void effects.booked(appointment, offer.practice);
      if (appointment)
        router.replace({ pathname: '/booking/success', params: { appointmentId: appointment.id } });
    } catch (e) {
      toast.show(
        isAppError(e, 'offer_expired') ? t('offer.expired') : t('errors.generic'),
        'error',
      );
    }
  }

  return (
    <View style={styles.root} testID="offer-screen">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.center}>
          <IllustrationCalendar size={120} />
        </View>
        <Text variant="h1" align="center">
          {t('offer.title')}
        </Text>
        <View
          style={styles.timer}
          accessible
          accessibilityLabel={t('offer.pendingA11y', { minutes: Math.ceil(msLeft / 60000) })}
          accessibilityLiveRegion="polite"
        >
          <Timer size={18} color={theme.colors.primary} strokeWidth={2.25} />
          <Text variant="bodyStrong" color="primary">
            {t('offer.reservedFor', { time: formatCountdown(msLeft) })}
          </Text>
        </View>
        <Card tone="primary">
          <View style={styles.rows}>
            <Text variant="h3">{formatLongDate(offer.slot.startsAt, locale)}</Text>
            <Row
              icon={Clock}
              text={t('time.timeOClock', { time: formatBerlinTime(offer.slot.startsAt, locale) })}
            />
            <Row icon={Stethoscope} text={`${offer.practice.name} · ${offer.doctor.name}`} />
            <Row
              icon={MapPin}
              text={`${offer.practice.address.street}, ${offer.practice.address.city}`}
            />
          </View>
        </Card>
        <Text variant="h3">{t('booking.contactTitle')}</Text>
        <ContactForm defaultValues={contact.data} onChange={setContactValue} />
        {repo.mode === 'supabase' ? (
          <EmailVerification verified={!needsVerification} email={session.data?.email ?? null} />
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Button
          variant="text"
          label={t('offer.decline')}
          onPress={async () => {
            await respond.mutateAsync({ offerId: offer.id, accept: false }).catch(() => undefined);
            toast.show(t('offer.declined'), 'info');
            router.back();
          }}
        />
        <Button
          style={styles.flex}
          label={t('offer.accept')}
          disabled={!contactValue || needsVerification}
          loading={respond.isPending}
          onPress={() => void accept()}
          testID="accept-offer"
        />
      </View>
    </View>
  );
}

function Row({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Icon size={16} color={theme.colors.primary} strokeWidth={2.25} />
      <Text variant="body" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  pad: { padding: t.space.lg },
  content: { padding: t.space.lg, gap: t.space.md },
  center: { alignItems: 'center' },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    alignSelf: 'center',
    backgroundColor: t.colors.primarySoft,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.xs,
    borderRadius: t.radius.pill,
  },
  rows: { gap: t.space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  flex: { flex: 1 },
  footer: {
    flexDirection: 'row',
    gap: t.space.sm,
    alignItems: 'center',
    paddingTop: t.space.sm,
    paddingHorizontal: t.space.lg,
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
}));
