import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { Avatar, Button, Card, SectionHeader, Skeleton, Stagger, Text } from '@/components';
import { CalendarCheck, Heart } from '@/components/icons';
import { usePractice, usePracticeSlots } from '@/data/hooks';
import { makeStyles, useTheme } from '@/design/theme';
import { earliestBookable } from '@/domain/availability/status';
import { specialtyById } from '@/domain/seed/catalog';
import type { AppointmentWithDetails } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { formatSlotWhen } from '@/lib/format';
import { useFavorites } from '@/state/favorites';

const MAX_ITEMS = 6;

type Item = { practiceId: string; favorite: boolean };

/**
 * Block 4 der Startseite – „Deine Praxen“ (Feature 6): gemerkte Praxen und die zuletzt
 * besuchten (aus den eigenen Terminen). Jede Karte zeigt den nächsten freien Termin;
 * „Buchen“ öffnet direkt die Buchung für diesen Termin.
 * Nutzen: Wiederbuchen in zwei Taps – Karte „Buchen“, dann bestätigen.
 * Ohne Favoriten und ohne frühere Termine wird der Block nicht angezeigt.
 */
export function MyPractices({
  appointments,
  now,
}: {
  appointments: readonly AppointmentWithDetails[];
  now: Date;
}) {
  const styles = useStyles();
  const { t } = useT();
  const favorites = useFavorites((s) => s.practiceIds);
  const items = useMemo<Item[]>(() => {
    const recent = [...appointments]
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
      .map((a) => a.practiceId);
    const out: Item[] = favorites.map((practiceId) => ({ practiceId, favorite: true }));
    for (const practiceId of recent) {
      if (!out.some((i) => i.practiceId === practiceId)) out.push({ practiceId, favorite: false });
    }
    return out.slice(0, MAX_ITEMS);
  }, [appointments, favorites]);

  if (items.length === 0) return null;
  return (
    <View style={styles.section} testID="my-practices">
      <SectionHeader title={t('home.myPractices')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((item, i) => (
          <Stagger key={item.practiceId} index={i}>
            <PracticeShortcut item={item} now={now} index={i} />
          </Stagger>
        ))}
      </ScrollView>
    </View>
  );
}

function PracticeShortcut({ item, now, index }: { item: Item; now: Date; index: number }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t, locale } = useT();
  const detail = usePractice(item.practiceId);
  const slots = usePracticeSlots(item.practiceId);
  const practice = detail.data?.practice;
  const next = useMemo(() => earliestBookable(slots.data ?? [], now), [slots.data, now]);

  if (!practice) {
    return (
      <View style={styles.card}>
        <Skeleton width="70%" height={18} />
        <Skeleton width="40%" height={14} />
        <Skeleton height={44} />
      </View>
    );
  }
  const specialty = specialtyById(practice.specialtyIds[0] ?? 0);
  const when = next ? formatSlotWhen(next.startsAt, now, t, locale) : null;
  return (
    <Card
      onPress={() => router.push(`/practice/${practice.id}`)}
      accessibilityRole="button"
      accessibilityLabel={[
        practice.name,
        item.favorite ? t('favorites.saved') : t('home.visitedBefore'),
        when ? t('home.nextFree', { when }) : t('card.noSlotInWindow'),
      ].join(', ')}
      style={styles.card}
      testID={`my-practice-${index}`}
    >
      <View style={styles.head}>
        <Avatar name={practice.name} size={40} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {practice.name}
          </Text>
          <Text variant="small" color="textSecondary" numberOfLines={1}>
            {specialty ? t(`specialtyShort.${specialty.slug}`) : ''}
          </Text>
        </View>
        {item.favorite ? (
          <Heart size={18} color={theme.colors.accent} fill={theme.colors.accent} strokeWidth={2} />
        ) : null}
      </View>
      {slots.isLoading ? (
        <Skeleton height={44} />
      ) : next ? (
        <Button
          variant="primary"
          icon={CalendarCheck}
          label={t('practice.bookAt', { time: when! })}
          onPress={() =>
            router.push({
              pathname: '/booking/[slotId]',
              params: { slotId: next.id, practiceId: practice.id },
            })
          }
          testID={`my-practice-book-${index}`}
        />
      ) : (
        <Text variant="small" color="textSecondary">
          {t('card.noSlotInWindow')}
        </Text>
      )}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  section: { gap: t.space.sm },
  row: { gap: t.space.sm, paddingRight: t.space.xl, paddingVertical: t.space.xxs },
  card: {
    width: 260,
    gap: t.space.sm,
    padding: t.space.md,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space.sm },
  flex: { flex: 1, gap: 2 },
}));
