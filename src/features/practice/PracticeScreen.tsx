import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  DemoBadge,
  EmptyState,
  FreshnessLabel,
  IllustrationOffline,
  IllustrationPractice,
  SectionHeader,
  Skeleton,
  StatusBadge,
  Text,
  useToast,
} from '@/components';
import { Bell, CalendarCheck, Globe, MapPin, Navigation, Phone } from '@/components/icons';
import { STATUS_VISUALS } from '@/components/status';
import {
  useAppointments,
  usePractice,
  usePracticeSlots,
  useRealtimeSlots,
  useSearchCenter,
} from '@/data/hooks';
import { makeStyles, useTheme } from '@/design/theme';
import { isSlotBookable, summarizeSlots } from '@/domain/availability/status';
import { distanceMeters } from '@/domain/geo/distance';
import { encodeGeohash } from '@/domain/geo/geohash';
import { specialtyById } from '@/domain/seed/catalog';
import { formatBerlinTime } from '@/domain/time/berlin';
import type { Slot } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { formatDistance, formatSlotWhen } from '@/lib/format';
import { callPhone, openRoute } from '@/lib/maps';
import { useNow } from '@/lib/useNow';

import {
  AccessibilityInfo,
  DoctorsList,
  LanguagesAndInsurance,
  OpeningHours,
  Reviews,
  ServicesList,
  SourceInfo,
} from './PracticeDetails';
import { SlotPicker } from './SlotPicker';

export function PracticeScreen() {
  const theme = useTheme();
  const styles = useStyles();
  // Querformat/niedrige Fenster: Illustration verkleinern, damit Inhalte sichtbar bleiben
  const compactHero = useWindowDimensions().height < 500;
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const toast = useToast();
  const now = useNow(30_000);
  const { id, slot: preselect } = useLocalSearchParams<{ id: string; slot?: string }>();
  const detail = usePractice(id);
  const slotsQuery = usePracticeSlots(id);
  const center = useSearchCenter();
  const [pickedId, setPickedId] = useState<string | null>(preselect ?? null);
  const notifiedTaken = useRef<string | null>(null);
  const isFocused = useIsFocused();
  const appointments = useAppointments();

  const practice = detail.data?.practice;
  useRealtimeSlots(practice ? [encodeGeohash(practice.location, 5)] : null);

  const slots = useMemo(() => slotsQuery.data ?? [], [slotsQuery.data]);
  const lastSyncedAt = detail.data?.lastSyncedAt ?? null;
  const summaryToday = summarizeSlots(slots, 'today', lastSyncedAt, now);
  const summary =
    summaryToday.openCount > 0 ? summaryToday : summarizeSlots(slots, 'week', lastSyncedAt, now);
  const windowLabel =
    summaryToday.openCount > 0 ? t('practice.banner.windowToday') : t('practice.banner.windowWeek');

  // Ohne eigene Wahl ist der früheste freie Termin vorausgewählt (kürzester Weg zur Buchung).
  const candidateId =
    pickedId ?? (summary.status !== 'unknown' ? (summary.nextSlot?.id ?? null) : null);
  const candidate = candidateId ? slots.find((s) => s.id === candidateId) : undefined;
  // Gerade vergeben (Realtime)? Dann keine Auswahl. Ein eigener Checkout-Hold zählt nicht.
  const taken =
    !!candidate &&
    (candidate.status === 'booked' ||
      candidate.status === 'cancelled' ||
      candidate.holdReason === 'waitlist_offer');
  const selected = taken ? undefined : candidate;
  const selectedId = selected?.id ?? null;
  // Selbst gebucht (Buchung läuft über dieser Seite) ist kein „vergeben“.
  const bookedByMe =
    !!candidate &&
    (appointments.data ?? []).some((a) => a.slotId === candidate.id && a.status === 'confirmed');

  useEffect(() => {
    if (taken && pickedId && isFocused && !bookedByMe && notifiedTaken.current !== pickedId) {
      notifiedTaken.current = pickedId;
      toast.show(t('booking.errors.slotTaken'), 'error');
    }
  }, [taken, pickedId, isFocused, bookedByMe, toast, t]);

  if (detail.isLoading) {
    return (
      <View style={[styles.root, { paddingTop: 16 }]}>
        <View style={styles.content}>
          <Skeleton height={32} width="70%" />
          <Skeleton height={18} width="40%" />
          <Skeleton height={64} />
          <Skeleton height={180} />
        </View>
      </View>
    );
  }

  if (!practice) {
    return (
      <View style={[styles.root, { paddingTop: 16 }]}>
        <EmptyState
          tone={detail.isError ? 'error' : 'neutral'}
          illustration={<IllustrationOffline size={150} />}
          title={detail.isError ? t('errors.generic') : t('practice.notFound')}
          primaryAction={
            detail.isError
              ? { label: t('common.retry'), onPress: () => void detail.refetch() }
              : { label: t('common.back'), onPress: () => router.back() }
          }
        />
      </View>
    );
  }

  const specialty = specialtyById(practice.specialtyIds[0] ?? 1);
  const distance = center.center
    ? formatDistance(distanceMeters(center.center, practice.location), t, locale)
    : null;
  const visual = STATUS_VISUALS[summary.status];
  const BannerIcon = visual.icon;
  const bannerText =
    summary.status === 'free'
      ? t('practice.banner.free', { count: summary.openCount, window: windowLabel })
      : summary.status === 'few'
        ? t('practice.banner.few', { count: summary.openCount, window: windowLabel })
        : summary.status === 'booked'
          ? t('practice.banner.booked', { window: windowLabel })
          : t('practice.banner.unknown');
  const canBook = summary.status !== 'unknown' && slots.some((s) => isSlotBookable(s, now));

  const footer = selected ? (
    <Button
      label={t('practice.bookAt', { time: formatSlotWhen(selected.startsAt, now, t, locale) })}
      icon={CalendarCheck}
      onPress={() =>
        router.push({
          pathname: '/booking/[slotId]',
          params: { slotId: selected.id, practiceId: practice.id },
        })
      }
      testID="book-button"
    />
  ) : canBook ? (
    <Button label={t('practice.chooseTime')} disabled testID="book-button" />
  ) : summary.status === 'unknown' && practice.phone ? (
    <Button label={t('common.call')} icon={Phone} onPress={() => callPhone(practice.phone!)} />
  ) : (
    <Button
      label={t('practice.notifyMe')}
      icon={Bell}
      onPress={() => router.push(`/waitlist/${practice.id}`)}
      testID="notify-me"
    />
  );

  return (
    <View style={styles.root} testID="practice-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Foto-Header (ohne Foto: warme Illustration). Bewusst flach, damit die freien
            Termine ohne Scrollen sichtbar sind; im Querformat noch flacher. */}
        <View
          style={[
            practice.photoUrl ? styles.heroPhoto : styles.hero,
            compactHero && styles.heroCompact,
          ]}
        >
          {practice.photoUrl ? (
            <Image
              source={{ uri: practice.photoUrl }}
              placeholder={
                practice.photoBlurhash ? { blurhash: practice.photoBlurhash } : undefined
              }
              style={styles.heroImage}
              contentFit="cover"
              accessibilityLabel={t('practice.photoA11y')}
            />
          ) : (
            <LinearGradient
              colors={[theme.colors.blobTeal, theme.colors.background]}
              style={styles.heroImage}
            >
              <View style={styles.heroIllustration}>
                <IllustrationPractice size={compactHero ? 72 : 104} />
              </View>
            </LinearGradient>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.titleBlock}>
            <Text variant="h1">{practice.name}</Text>
            <Text variant="body" color="textSecondary">
              {specialty ? t(`specialty.${specialty.slug}`) : ''}
            </Text>
            <View style={styles.metaRow}>
              <MapPin size={16} color={theme.colors.textSecondary} strokeWidth={2} />
              <Text variant="small" color="textSecondary" style={styles.flex}>
                {practice.address.street}, {practice.address.postalCode} {practice.address.city}
                {distance ? ` · ${distance}` : ''}
              </Text>
            </View>
            {practice.isDemo ? (
              <View style={styles.metaRow}>
                <DemoBadge />
                <Text variant="caption" color="textSecondary" style={styles.flex}>
                  {t('app.demoNotice')}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Button
              variant="secondary"
              label={t('practice.route')}
              icon={Navigation}
              accessibilityLabel={t('practice.routeA11y')}
              onPress={() => void openRoute(practice)}
              style={styles.flex}
            />
            {practice.phone ? (
              <Button
                variant="secondary"
                label={t('common.call')}
                icon={Phone}
                accessibilityLabel={t('practice.callA11y', { phone: practice.phone })}
                onPress={() => callPhone(practice.phone!)}
                style={styles.flex}
              />
            ) : null}
            {practice.website ? (
              <Button
                variant="secondary"
                label={t('common.website')}
                icon={Globe}
                onPress={() => void Linking.openURL(practice.website!)}
              />
            ) : null}
          </View>

          {/* Verfügbarkeits-Banner: Farbe + Icon + Text + Alter der Daten */}
          <View
            style={[styles.banner, { backgroundColor: theme.colors[visual.bg] }]}
            accessible
            // „summary“ wird im Web zu einer namenlosen Region – dort nur gruppieren.
            accessibilityRole={Platform.OS === 'web' ? undefined : 'summary'}
            testID="availability-banner"
          >
            <BannerIcon size={24} color={theme.colors[visual.fg]} strokeWidth={2.25} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" style={{ color: theme.colors[visual.fg] }}>
                {bannerText}
              </Text>
              <FreshnessLabel lastSyncedAt={lastSyncedAt} />
            </View>
          </View>

          {summary.status !== 'unknown' ? (
            <View style={styles.section}>
              <SectionHeader title={t('practice.pickSlot')} />
              {slotsQuery.isLoading ? (
                <Skeleton height={140} />
              ) : (
                <SlotPicker
                  slots={slots}
                  doctors={detail.data?.doctors ?? []}
                  now={now}
                  selectedId={selectedId}
                  onSelect={(s: Slot) => setPickedId(s.id)}
                />
              )}
              {selected ? (
                <View style={styles.metaRow} accessibilityLiveRegion="polite">
                  <StatusBadge
                    status="free"
                    size="sm"
                    label={`${formatSlotWhen(selected.startsAt, now, t, locale)} · ${formatBerlinTime(selected.endsAt, locale)}`}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader title={t('practice.openingHours')} />
            <OpeningHours practice={practice} />
          </View>
          {practice.services.length ? (
            <View style={styles.section}>
              <SectionHeader title={t('practice.services')} />
              <ServicesList practice={practice} />
            </View>
          ) : null}
          <View style={styles.section}>
            <SectionHeader title={t('practice.accessibility')} />
            <AccessibilityInfo practice={practice} />
          </View>
          <View style={styles.section}>
            <SectionHeader title={`${t('practice.languages')} · ${t('practice.insurance')}`} />
            <LanguagesAndInsurance practice={practice} />
          </View>
          {detail.data?.doctors.length ? (
            <View style={styles.section}>
              <SectionHeader title={t('practice.doctors')} />
              <DoctorsList doctors={detail.data.doctors} />
            </View>
          ) : null}
          <View style={styles.section}>
            <SectionHeader title={t('practice.reviews')} />
            <Reviews practice={practice} />
          </View>
          <View style={styles.section}>
            <SectionHeader title={t('practice.source')} />
            <SourceInfo practice={practice} lastSyncedAt={lastSyncedAt} />
          </View>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  hero: { height: 120 },
  heroPhoto: { height: 160 },
  heroCompact: { height: 88 },
  heroImage: { ...{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } },
  heroIllustration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: t.space.sm,
  },
  content: {
    paddingHorizontal: t.layout.screenPadding,
    gap: t.space.lg,
    maxWidth: t.layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  titleBlock: { gap: t.space.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs, flexWrap: 'wrap' },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: t.space.sm, flexWrap: 'wrap' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    padding: t.space.md,
    borderRadius: t.radius.md,
  },
  section: { gap: t.space.sm },
  footer: {
    paddingTop: t.space.sm,
    paddingHorizontal: t.layout.screenPadding,
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    boxShadow: t.shadows.lg,
  },
}));
