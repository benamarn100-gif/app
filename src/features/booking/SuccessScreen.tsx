import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion, FadeIn } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedCheck, Button, OrganicBackground, Text, useToast } from '@/components';
import { Bell, BellRing, CalendarCheck, CalendarPlus, Navigation } from '@/components/icons';
import { useAppointments } from '@/data/hooks';
import { makeStyles } from '@/design/theme';
import { AppointmentCard } from '@/features/appointments/AppointmentCard';
import { useT } from '@/i18n/useT';
import { addAppointmentToCalendar } from '@/lib/calendar';
import { openRoute } from '@/lib/maps';
import { requestNotificationPermission, scheduleReminders } from '@/lib/notifications';
import { usePreferences } from '@/state/preferences';

/**
 * Signature-Moment 2: Buchungserfolg – Haken zeichnet sich, sanftes Leuchten,
 * Erfolgs-Haptik. Danach: Kalender, Erinnerungen (Erlaubnis im Moment des Nutzens), Route.
 */
export function SuccessScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const toast = useToast();
  const reduce = useReducedMotion();
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const appointments = useAppointments();
  const setPrefs = usePreferences((s) => s.set);
  const [calendarDone, setCalendarDone] = useState(false);
  const [remindersDone, setRemindersDone] = useState(false);
  const appointment = appointments.data?.find((a) => a.id === appointmentId);

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      testID="booking-success"
    >
      <OrganicBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.center}>
          <AnimatedCheck size={110} />
        </View>
        <Animated.View
          entering={reduce ? FadeIn : FadeInDown.delay(250).springify().damping(18).stiffness(220)}
          style={styles.texts}
        >
          <Text
            variant="display"
            align="center"
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
          >
            {t('booking.successTitle')}
          </Text>
          <Text variant="body" color="textSecondary" align="center">
            {t('booking.successBody')}
          </Text>
        </Animated.View>
        {appointment ? <AppointmentCard appointment={appointment} /> : null}
        {appointment ? (
          <View style={styles.actions}>
            <Button
              variant="secondary"
              icon={calendarDone ? CalendarCheck : CalendarPlus}
              label={calendarDone ? t('booking.calendarAdded') : t('booking.addToCalendar')}
              disabled={calendarDone}
              onPress={async () => {
                const result = await addAppointmentToCalendar(appointment, appointment.practice, t);
                if (result === 'saved') setCalendarDone(true);
              }}
              testID="add-to-calendar"
            />
            <Button
              variant="secondary"
              icon={remindersDone ? BellRing : Bell}
              label={remindersDone ? t('booking.remindersEnabled') : t('booking.enableReminders')}
              disabled={remindersDone}
              onPress={async () => {
                const granted = await requestNotificationPermission();
                if (!granted) {
                  toast.show(t('booking.remindersDenied'), 'info');
                  return;
                }
                setPrefs({ remindersEnabled: true });
                await scheduleReminders(appointment, t, locale);
                setRemindersDone(true);
                toast.show(t('booking.remindersEnabled'), 'success');
              }}
              testID="enable-reminders"
            />
            <Button
              variant="secondary"
              icon={Navigation}
              label={t('booking.planRoute')}
              onPress={() => void openRoute(appointment.practice)}
            />
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label={t('common.done')}
          onPress={() => router.dismissTo('/(tabs)/appointments')}
          testID="success-done"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: {
    padding: t.space.lg,
    gap: t.space.lg,
    maxWidth: t.layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  center: { alignItems: 'center' },
  texts: { gap: t.space.xs },
  actions: { gap: t.space.sm },
  footer: {
    paddingHorizontal: t.space.lg,
    maxWidth: t.layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
}));
