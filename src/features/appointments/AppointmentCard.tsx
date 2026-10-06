import { View } from 'react-native';

import { Avatar, Button, Card, DemoBadge, Text } from '@/components';
import { CalendarPlus, Clock, MapPin, Navigation, RotateCcw, Video, X } from '@/components/icons';
import { makeStyles, useTheme } from '@/design/theme';
import { specialtyById } from '@/domain/seed/catalog';
import { formatBerlinTime } from '@/domain/time/berlin';
import type { AppointmentWithDetails } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { formatLongDate } from '@/lib/format';

type Props = {
  appointment: AppointmentWithDetails;
  compact?: boolean;
  onPress?: () => void;
  onCancel?: () => void;
  onReschedule?: () => void;
  onRoute?: () => void;
  onCalendar?: () => void;
  onBookAgain?: () => void;
};

export function AppointmentCard({
  appointment,
  compact,
  onPress,
  onCancel,
  onReschedule,
  onRoute,
  onCalendar,
  onBookAgain,
}: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const { t, locale } = useT();
  const date = formatLongDate(appointment.startsAt, locale);
  const time = t('time.timeOClock', { time: formatBerlinTime(appointment.startsAt, locale) });
  const specialty = specialtyById(
    appointment.doctor.specialtyIds[0] ?? appointment.practice.specialtyIds[0] ?? 1,
  );
  const cancelled = appointment.status === 'cancelled';
  const completed = appointment.status === 'completed';

  return (
    <Card
      onPress={onPress}
      style={cancelled ? styles.cancelled : undefined}
      accessibilityLabel={t('appointments.a11y', {
        date,
        time,
        practice: appointment.practice.name,
        doctor: appointment.doctor.name,
      })}
      testID={`appointment-${appointment.id}`}
    >
      <View style={styles.header}>
        <View style={styles.dateBadge}>
          <Clock size={16} color={theme.colors.primary} strokeWidth={2.25} />
          <Text variant="smallStrong" color="primary">
            {time}
          </Text>
        </View>
        {cancelled ? (
          <Text variant="caption" color="statusBooked">
            {t('appointments.statusCancelled')}
          </Text>
        ) : completed ? (
          <Text variant="caption" color="textSecondary">
            {t('appointments.statusCompleted')}
          </Text>
        ) : appointment.visitType === 'video' ? (
          <View style={styles.row}>
            <Video size={14} color={theme.colors.textSecondary} strokeWidth={2} />
            <Text variant="caption" color="textSecondary">
              {t('practice.videoSlot')}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="h3" style={styles.date}>
        {date}
      </Text>
      <View style={styles.practiceRow}>
        <Avatar name={appointment.practice.name} size={40} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{appointment.practice.name}</Text>
          <Text variant="small" color="textSecondary">
            {appointment.doctor.name}
            {specialty ? ` · ${t(`specialty.${specialty.slug}`)}` : ''}
          </Text>
          {appointment.patientLabel ? (
            <Text variant="small" color="textSecondary">
              {t('appointments.forPatient', { name: appointment.patientLabel })}
            </Text>
          ) : null}
        </View>
      </View>
      {!compact ? (
        <View style={styles.address}>
          <MapPin size={14} color={theme.colors.textSecondary} strokeWidth={2} />
          <Text variant="small" color="textSecondary" style={styles.flex}>
            {appointment.practice.address.street}, {appointment.practice.address.postalCode}{' '}
            {appointment.practice.address.city}
          </Text>
          {appointment.practice.isDemo ? <DemoBadge /> : null}
        </View>
      ) : null}
      {!compact && !cancelled && !completed ? (
        <View style={styles.actions}>
          {onRoute ? (
            <Button
              variant="secondary"
              label={t('common.route')}
              icon={Navigation}
              onPress={onRoute}
            />
          ) : null}
          {onCalendar ? (
            <Button
              variant="secondary"
              label={t('appointments.inCalendar')}
              icon={CalendarPlus}
              onPress={onCalendar}
            />
          ) : null}
          {onReschedule ? (
            <Button
              variant="text"
              label={t('appointments.reschedule')}
              icon={RotateCcw}
              onPress={onReschedule}
            />
          ) : null}
          {onCancel ? (
            <Button
              variant="text"
              label={t('appointments.cancel')}
              icon={X}
              onPress={onCancel}
              testID="cancel-appointment"
            />
          ) : null}
        </View>
      ) : null}
      {!compact && (cancelled || completed) && onBookAgain ? (
        <View style={styles.actions}>
          <Button
            variant="secondary"
            label={t('appointments.bookAgain')}
            icon={RotateCcw}
            onPress={onBookAgain}
          />
        </View>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  cancelled: { opacity: 0.75 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.xs,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xxs,
    backgroundColor: t.colors.primarySoft,
    paddingHorizontal: t.space.sm,
    paddingVertical: t.space.xxs,
    borderRadius: t.radius.pill,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.xxs },
  date: { marginTop: t.space.sm },
  practiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    marginTop: t.space.sm,
  },
  flex: { flex: 1 },
  address: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xxs,
    marginTop: t.space.sm,
    flexWrap: 'wrap',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs, marginTop: t.space.md },
}));
