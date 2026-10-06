import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Chip, PressableScale, SlotChip, Text } from '@/components';
import { makeStyles } from '@/design/theme';
import { isSlotBookable } from '@/domain/availability/status';
import {
  berlinDayOffset,
  formatBerlinDate,
  formatBerlinTime,
  toBerlin,
} from '@/domain/time/berlin';
import type { Doctor, Slot } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { haptics } from '@/lib/haptics';

type Props = {
  slots: Slot[];
  doctors: Doctor[];
  now: Date;
  selectedId: string | null;
  onSelect: (slot: Slot) => void;
  days?: number;
};

type DayInfo = { offset: number; iso: string; count: number };

/** Slot-Picker: Wochenstreifen (Tage mit Anzahl freier Zeiten) + Zeit-Chips nach Tageszeit. */
export function SlotPicker({ slots, doctors, now, selectedId, onSelect, days = 14 }: Props) {
  const styles = useStyles();
  const { t, locale } = useT();
  const [doctorId, setDoctorId] = useState<string | null>(null);

  const bookable = useMemo(
    () => slots.filter((s) => isSlotBookable(s, now) && (!doctorId || s.doctorId === doctorId)),
    [slots, now, doctorId],
  );

  const dayList = useMemo<DayInfo[]>(() => {
    const list: DayInfo[] = Array.from({ length: days }, (_, offset) => ({
      offset,
      iso: new Date(now.getTime() + offset * 864e5).toISOString(),
      count: 0,
    }));
    for (const s of bookable) {
      const offset = berlinDayOffset(s.startsAt, now);
      const day = list[offset];
      if (day) day.count++;
    }
    return list;
  }, [bookable, days, now]);

  const selectedSlot = selectedId ? slots.find((s) => s.id === selectedId) : undefined;
  const firstDayWithSlots = dayList.find((d) => d.count > 0)?.offset ?? 0;
  // Angezeigter Tag: eigene Wahl, sonst der Tag der (Vor-)Auswahl, sonst der erste freie Tag
  const [manualDay, setManualDay] = useState<number | null>(null);
  const day =
    manualDay ?? (selectedSlot ? berlinDayOffset(selectedSlot.startsAt, now) : firstDayWithSlots);
  const setDay = setManualDay;

  const daySlots = bookable
    .filter((s) => berlinDayOffset(s.startsAt, now) === day)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const groups = [
    {
      key: 'morning',
      label: t('practice.morning'),
      slots: daySlots.filter((s) => toBerlin(s.startsAt).getHours() < 12),
    },
    {
      key: 'afternoon',
      label: t('practice.afternoon'),
      slots: daySlots.filter(
        (s) => toBerlin(s.startsAt).getHours() >= 12 && toBerlin(s.startsAt).getHours() < 17,
      ),
    },
    {
      key: 'evening',
      label: t('practice.evening'),
      slots: daySlots.filter((s) => toBerlin(s.startsAt).getHours() >= 17),
    },
  ].filter((g) => g.slots.length);
  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.name ?? '';
  const nextDay = dayList.find((d) => d.offset > day && d.count > 0);

  return (
    <View style={styles.container}>
      {doctors.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          <Chip
            role="radio"
            label={t('practice.anyDoctor')}
            selected={!doctorId}
            onPress={() => setDoctorId(null)}
          />
          {doctors.map((d) => (
            <Chip
              key={d.id}
              role="radio"
              label={d.name}
              selected={doctorId === d.id}
              onPress={() => setDoctorId(d.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="tablist"
      >
        {dayList.map((d) => {
          const active = d.offset === day;
          const label =
            d.offset === 0
              ? t('time.today')
              : d.offset === 1
                ? t('time.tomorrow')
                : formatBerlinDate(d.iso, locale, { weekday: 'short' });
          const date = formatBerlinDate(d.iso, locale, { day: 'numeric', month: 'numeric' });
          return (
            <PressableScale
              key={d.offset}
              onPress={() => {
                haptics.selection();
                setDay(d.offset);
              }}
              accessibilityRole="tab"
              // Tage ohne freie Termine sind nicht wählbar (auch nicht per Screenreader).
              disabled={d.count === 0}
              accessibilityState={{ selected: active, disabled: d.count === 0 }}
              accessibilityLabel={t('practice.weekStripA11y', {
                date: `${label} ${date}`,
                count: d.count,
              })}
              style={[styles.day, active && styles.dayActive, d.count === 0 && styles.dayEmpty]}
              testID={`day-${d.offset}`}
            >
              <Text variant="caption" color={active ? 'textOnPrimary' : 'textSecondary'}>
                {label}
              </Text>
              <Text variant="bodyStrong" color={active ? 'textOnPrimary' : 'textPrimary'}>
                {date}
              </Text>
              <Text
                variant="caption"
                color={active ? 'textOnPrimary' : d.count ? 'primary' : 'textSecondary'}
              >
                {d.count}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="body" color="textSecondary">
            {t('practice.noSlotsThisDay')}
          </Text>
          {nextDay ? (
            <Chip
              role="button"
              label={t('practice.nextFreeDay', {
                day: formatBerlinDate(nextDay.iso, locale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                }),
              })}
              onPress={() => setDay(nextDay.offset)}
            />
          ) : null}
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <Text variant="smallStrong" color="textSecondary">
              {group.label}
            </Text>
            <View
              style={styles.times}
              accessibilityRole="radiogroup"
              accessibilityLabel={group.label}
            >
              {group.slots.map((s) => (
                <SlotChip
                  key={s.id}
                  time={formatBerlinTime(s.startsAt, locale)}
                  video={s.visitType === 'video'}
                  selected={s.id === selectedId}
                  onPress={() => onSelect(s)}
                  accessibilityLabel={t('practice.slotA11y', {
                    time: formatBerlinTime(s.startsAt, locale),
                    doctor: doctorName(s.doctorId),
                  })}
                  testID={`slot-${s.id}`}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: { gap: t.space.md },
  row: { gap: t.space.xs, paddingRight: t.space.md },
  day: {
    width: 64,
    minHeight: 76,
    borderRadius: t.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.border,
  },
  dayActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  dayEmpty: { opacity: 0.55 },
  empty: { gap: t.space.sm, alignItems: 'flex-start' },
  group: { gap: t.space.xs },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs },
}));
