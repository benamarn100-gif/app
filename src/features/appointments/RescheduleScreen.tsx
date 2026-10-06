import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  EmptyState,
  IllustrationOffline,
  Skeleton,
  Text,
  useToast,
} from '@/components';
import {
  useAppointments,
  usePractice,
  usePracticeSlots,
  useRescheduleAppointment,
} from '@/data/hooks';
import { isAppError } from '@/data/repository';
import { makeStyles } from '@/design/theme';
import type { Slot } from '@/domain/types';
import { SlotPicker } from '@/features/practice/SlotPicker';
import { useT } from '@/i18n/useT';
import { formatSlotWhen } from '@/lib/format';
import { cancelReminders, notificationPermission, scheduleReminders } from '@/lib/notifications';
import { useNow } from '@/lib/useNow';
import { usePreferences } from '@/state/preferences';

/** Verschieben: neue Zeit wählen – Buchung und Storno laufen in einer Transaktion. */
export function RescheduleScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const toast = useToast();
  const now = useNow(30_000);
  const { id } = useLocalSearchParams<{ id: string }>();
  const appointments = useAppointments();
  const appointment = appointments.data?.find((a) => a.id === id);
  const practice = usePractice(appointment?.practiceId);
  const slots = usePracticeSlots(appointment?.practiceId);
  const reschedule = useRescheduleAppointment();
  const remindersEnabled = usePreferences((s) => s.remindersEnabled);
  const [selected, setSelected] = useState<Slot | null>(null);
  const key = useMemo(() => Crypto.randomUUID(), []);

  if (appointments.isLoading) return <Skeleton height={200} />;
  if (!appointment) {
    return (
      <EmptyState
        illustration={<IllustrationOffline size={140} />}
        title={t('errors.notFound')}
        primaryAction={{ label: t('common.back'), onPress: () => router.back() }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card tone="muted">
          <Text variant="small" color="textSecondary">
            {appointment.practice.name}
          </Text>
          <Text variant="bodyStrong">{formatSlotWhen(appointment.startsAt, now, t, locale)}</Text>
        </Card>
        {slots.isLoading ? (
          <Skeleton height={160} />
        ) : (
          <SlotPicker
            slots={(slots.data ?? []).filter((s) => s.id !== appointment.slotId)}
            doctors={practice.data?.doctors ?? []}
            now={now}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Button
          label={
            selected
              ? `${t('appointments.reschedule')}: ${formatSlotWhen(selected.startsAt, now, t, locale)}`
              : t('practice.chooseTime')
          }
          disabled={!selected}
          loading={reschedule.isPending}
          onPress={async () => {
            if (!selected) return;
            try {
              const next = await reschedule.mutateAsync({
                appointmentId: appointment.id,
                newSlotId: selected.id,
                idempotencyKey: key,
              });
              void cancelReminders(appointment.id);
              if (remindersEnabled && (await notificationPermission()) === 'granted')
                void scheduleReminders(next, t, locale);
              toast.show(t('appointments.rescheduled'), 'success');
              router.back();
            } catch (e) {
              toast.show(
                isAppError(e, 'slot_taken') ? t('booking.errors.slotTaken') : t('errors.generic'),
                'error',
              );
              setSelected(null);
            }
          }}
          testID="confirm-reschedule"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: { padding: t.layout.screenPadding, gap: t.space.lg },
  footer: {
    paddingTop: t.space.sm,
    paddingHorizontal: t.layout.screenPadding,
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
}));
