import { useCallback, useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  EmptyState,
  IllustrationCalendar,
  IllustrationOffline,
  OfflineBanner,
  SectionHeader,
  SegmentedControl,
  SkeletonList,
  Stagger,
  Text,
  useConfirm,
  useToast,
} from '@/components';
import { BellRing, Hourglass } from '@/components/icons';
import {
  useAppointments,
  useCancelAppointment,
  useLeaveWaitlist,
  useOffers,
  useWaitlist,
} from '@/data/hooks';
import { makeStyles, useTheme } from '@/design/theme';
import { formatBerlinDate } from '@/domain/time/berlin';
import type { AppointmentWithDetails } from '@/domain/types';
import { BrandRefresh } from '@/features/home/BrandRefresh';
import { useT } from '@/i18n/useT';
import { addAppointmentToCalendar } from '@/lib/calendar';
import { formatCountdown, formatSlotWhen } from '@/lib/format';
import { openRoute } from '@/lib/maps';
import { cancelReminders } from '@/lib/notifications';
import { useNow } from '@/lib/useNow';

import { AppointmentCard } from './AppointmentCard';

export function AppointmentsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const client = useQueryClient();
  const now = useNow(1000);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const appointments = useAppointments();
  const offers = useOffers();
  const waitlist = useWaitlist();
  const cancel = useCancelAppointment();
  const leave = useLeaveWaitlist();

  const { upcoming, past } = useMemo(() => {
    const list = appointments.data ?? [];
    return {
      upcoming: list.filter(
        (a) => a.status === 'confirmed' && Date.parse(a.endsAt) > now.getTime(),
      ),
      past: list
        .filter((a) => a.status !== 'confirmed' || Date.parse(a.endsAt) <= now.getTime())
        .reverse(),
    };
  }, [appointments.data, now]);
  const pendingOffers = (offers.data ?? []).filter(
    (o) => o.status === 'pending' && Date.parse(o.expiresAt) > now.getTime(),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await client.invalidateQueries({ queryKey: ['me'] });
    setRefreshing(false);
  }, [client]);

  const confirmCancel = async (a: AppointmentWithDetails) => {
    const confirmed = await confirm({
      title: t('appointments.cancelConfirmTitle'),
      message: t('appointments.cancelConfirmBody'),
      cancelLabel: t('appointments.keep'),
      confirmLabel: t('appointments.cancelConfirm'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await cancel.mutateAsync({ id: a.id, slotId: a.slotId });
      void cancelReminders(a.id);
      toast.show(t('appointments.cancelled'), 'success');
    } catch {
      toast.show(t('errors.generic'), 'error');
    }
  };

  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <View style={styles.root} testID="appointments-screen">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + theme.space.md, paddingBottom: insets.bottom + 96 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={[theme.colors.primary]}
          />
        }
      >
        <BrandRefresh visible={refreshing} />
        <Text variant="h1">{t('appointments.title')}</Text>
        <OfflineBanner />

        {pendingOffers.map((offer) => (
          <Card
            key={offer.id}
            tone="accent"
            onPress={() => router.push(`/offer/${offer.id}`)}
            testID={`pending-offer-${offer.id}`}
            accessibilityLabel={t('offer.pendingA11y', {
              minutes: Math.ceil((Date.parse(offer.expiresAt) - now.getTime()) / 60000),
            })}
          >
            <View style={styles.offerRow}>
              <BellRing size={22} color={theme.colors.textPrimary} strokeWidth={2.25} />
              <View style={styles.flex}>
                <Text variant="h3">{t('offer.title')}</Text>
                <Text variant="body">
                  {formatSlotWhen(offer.slot.startsAt, now, t, locale)} · {offer.practice.name}
                </Text>
                <Text variant="smallStrong">
                  {t('offer.reservedFor', {
                    time: formatCountdown(Date.parse(offer.expiresAt) - now.getTime()),
                  })}
                </Text>
              </View>
            </View>
          </Card>
        ))}

        <SegmentedControl
          accessibilityLabel={t('appointments.title')}
          value={tab}
          onChange={setTab}
          options={[
            {
              value: 'upcoming',
              label: `${t('appointments.upcoming')}${upcoming.length ? ` (${upcoming.length})` : ''}`,
            },
            { value: 'past', label: t('appointments.past') },
          ]}
          testID="appointments-tabs"
        />

        {appointments.isLoading ? (
          <SkeletonList count={2} />
        ) : appointments.isError && !appointments.data ? (
          <EmptyState
            tone="error"
            illustration={<IllustrationOffline size={140} />}
            title={t('errors.generic')}
            primaryAction={{ label: t('common.retry'), onPress: () => void appointments.refetch() }}
          />
        ) : list.length === 0 ? (
          <EmptyState
            illustration={<IllustrationCalendar size={150} />}
            title={
              tab === 'upcoming' ? t('appointments.emptyUpcoming') : t('appointments.emptyPast')
            }
            primaryAction={
              tab === 'upcoming'
                ? { label: t('appointments.findAppointment'), onPress: () => router.push('/acute') }
                : undefined
            }
            testID="appointments-empty"
          />
        ) : (
          list.map((a, i) => (
            <Stagger key={a.id} index={i} animateLayout>
              <AppointmentCard
                appointment={a}
                onRoute={() => void openRoute(a.practice)}
                onCalendar={
                  Platform.OS === 'web'
                    ? undefined
                    : () => void addAppointmentToCalendar(a, a.practice, t)
                }
                onReschedule={() => router.push(`/appointments/${a.id}/reschedule`)}
                onCancel={() => confirmCancel(a)}
                onBookAgain={() => router.push(`/practice/${a.practiceId}`)}
              />
            </Stagger>
          ))
        )}

        {(waitlist.data ?? []).length ? (
          <View style={styles.section}>
            <SectionHeader title={t('appointments.waitlists')} />
            {(waitlist.data ?? []).map((entry, i) => (
              <Stagger key={entry.id} index={i} animateLayout>
                <Card tone="muted">
                  <View style={styles.offerRow}>
                    <Hourglass size={20} color={theme.colors.primary} strokeWidth={2.25} />
                    <View style={styles.flex}>
                      <Text variant="bodyStrong">
                        {entry.practiceName ??
                          (entry.target.kind === 'specialty'
                            ? t('waitlist.targetLabelSpecialty', {
                                specialty: t(`specialty.${entry.label}` as 'specialty.hno'),
                                km: entry.maxDistanceKm,
                              })
                            : entry.label)}
                      </Text>
                      <Text variant="small" color="textSecondary">
                        {t('waitlist.position', {
                          date: formatBerlinDate(entry.createdAt, locale, {
                            day: 'numeric',
                            month: 'long',
                          }),
                        })}
                      </Text>
                    </View>
                  </View>
                  <Button
                    variant="text"
                    label={t('waitlist.leave')}
                    onPress={async () => {
                      await leave.mutateAsync(entry.id);
                      toast.show(t('waitlist.left'), 'info');
                    }}
                    style={styles.leave}
                  />
                </Card>
              </Stagger>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: {
    paddingHorizontal: t.layout.screenPadding,
    gap: t.space.md,
    maxWidth: t.layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  offerRow: { flexDirection: 'row', gap: t.space.sm, alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  section: { gap: t.space.sm, marginTop: t.space.md },
  leave: { alignSelf: 'flex-start' },
}));
