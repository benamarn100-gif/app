import { View } from 'react-native';
import { router } from 'expo-router';

import { Button, Card, Skeleton, Text } from '@/components';
import { CalendarCheck, ChevronRight, Navigation, Zap } from '@/components/icons';
import { makeStyles, useTheme } from '@/design/theme';
import { distanceMeters } from '@/domain/geo/distance';
import type { AppointmentWithDetails, LatLng } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { formatDistance, formatSlotWhen } from '@/lib/format';
import { openRoute } from '@/lib/maps';

type Props = {
  /** Nächster bestätigter Termin; null = keiner geplant */
  appointment: AppointmentWithDetails | null;
  loading: boolean;
  now: Date;
  center: LatLng | null;
  /** Praxen mit freien Terminen in den nächsten 24 h (für den Akut-Hero), undefined = lädt */
  freeSoonCount: number | undefined;
};

/**
 * Block 1 der Startseite – beantwortet „Was ist mein nächster Termin?“:
 * Arzt, Datum, Entfernung und Route auf einen Blick. Ohne Termin wird der Block zum
 * Akut-Einstieg („Ich brauche bald einen Termin“).
 */
export function NextAppointmentHero({ appointment, loading, now, center, freeSoonCount }: Props) {
  if (loading) return <HeroSkeleton />;
  if (appointment) return <AppointmentHero appointment={appointment} now={now} center={center} />;
  return <AcuteHero freeSoonCount={freeSoonCount} />;
}

function HeroSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.skeleton} accessibilityElementsHidden importantForAccessibility="no">
      <Skeleton width={140} height={14} />
      <Skeleton width="70%" height={26} />
      <Skeleton width="55%" height={16} />
      <Skeleton height={48} />
    </View>
  );
}

function AppointmentHero({
  appointment: a,
  now,
  center,
}: {
  appointment: AppointmentWithDetails;
  now: Date;
  center: LatLng | null;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const { t, locale } = useT();
  const when = formatSlotWhen(a.startsAt, now, t, locale);
  const distance = center
    ? formatDistance(distanceMeters(center, a.practice.location), t, locale)
    : null;
  const who = [a.doctor.name, a.practice.name].join(' · ');
  const where = [distance, a.practice.address.street].filter(Boolean).join(' · ');
  const forWhom = a.patientLabel ? t('home.heroFor', { name: a.patientLabel }) : null;

  return (
    <Card
      tone="primary"
      padding="lg"
      onPress={() => router.push('/(tabs)/appointments')}
      accessibilityRole="button"
      accessibilityLabel={[t('home.nextAppointment'), when, who, forWhom, where]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={t('home.nextAppointmentHint')}
      testID="hero-appointment"
      style={styles.hero}
    >
      <View style={styles.kicker}>
        <CalendarCheck size={18} color={theme.colors.primary} strokeWidth={2.25} />
        <Text variant="smallStrong" color="primary">
          {t('home.nextAppointment')}
        </Text>
      </View>
      <Text variant="h1" numberOfLines={2}>
        {when}
      </Text>
      <View style={styles.lines}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {who}
        </Text>
        {forWhom ? (
          <Text variant="small" color="textSecondary">
            {forWhom}
          </Text>
        ) : null}
        {where ? (
          <Text variant="small" color="textSecondary" numberOfLines={1}>
            {where}
          </Text>
        ) : null}
      </View>
      {a.visitType !== 'video' ? (
        <Button
          variant="primary"
          label={t('practice.route')}
          icon={Navigation}
          accessibilityLabel={t('practice.routeA11y')}
          onPress={() => void openRoute(a.practice)}
          testID="hero-route"
        />
      ) : null}
    </Card>
  );
}

function AcuteHero({ freeSoonCount }: { freeSoonCount: number | undefined }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const status =
    freeSoonCount === undefined
      ? null
      : freeSoonCount > 0
        ? t('home.heroCount', { count: freeSoonCount })
        : t('home.heroNone');
  return (
    <Card
      tone="primary"
      padding="lg"
      onPress={() => router.navigate('/(tabs)/today')}
      accessibilityRole="button"
      // Alles Sichtbare in einer Ansage (WCAG 2.5.3: sichtbarer Name steht vorn).
      accessibilityLabel={[`${t('home.heroTitle')}.`, t('home.heroBody'), status]
        .filter(Boolean)
        .join(' ')}
      accessibilityHint={t('home.heroA11yHint')}
      testID="hero-acute"
      style={[styles.hero, styles.row]}
    >
      <View style={styles.heroIcon}>
        <Zap
          size={24}
          color={theme.colors.textOnPrimary}
          strokeWidth={2.25}
          fill={theme.colors.textOnPrimary}
        />
      </View>
      <View style={styles.flex}>
        <Text variant="h2">{t('home.heroTitle')}</Text>
        <Text variant="body" color="textSecondary">
          {t('home.heroBody')}
        </Text>
        {freeSoonCount === undefined ? (
          <Skeleton width={180} height={16} />
        ) : (
          <Text variant="smallStrong" color="primary">
            {status}
          </Text>
        )}
      </View>
      <ChevronRight size={24} color={theme.colors.primary} strokeWidth={2.25} />
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  hero: { gap: t.space.sm, boxShadow: t.shadows.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.md },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: t.space.xxs },
  lines: { gap: 2 },
  flex: { flex: 1, gap: t.space.xxs },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: t.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeleton: {
    gap: t.space.sm,
    padding: t.space.lg,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
  },
}));
