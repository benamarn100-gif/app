import { memo } from 'react';
import { View } from 'react-native';

import { makeStyles, useTheme } from '@/design/theme';
import { specialtyById } from '@/domain/seed/catalog';
import type { PracticeAvailability, TimeWindow } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { formatDistance, formatSlotWhen } from '@/lib/format';
import { useNow } from '@/lib/useNow';

import { Avatar } from './Avatar';
import { Card } from './Card';
import { DemoBadge } from './DemoBadge';
import { FreshnessLabel, freshnessText } from './FreshnessLabel';
import { MapPin, Star, Video } from './icons';
import { StatusBadge } from './StatusBadge';
import { Text } from './Text';

type Props = {
  item: PracticeAvailability;
  onPress?: (practiceId: string) => void;
  variant?: 'row' | 'compact';
  window?: TimeWindow;
  testID?: string;
};

/**
 * Praxiskarte: Name, Fachrichtung, Status (Icon + Text + Farbe), nächster freier
 * Termin mit Entfernung („Heute 14:30 · 2,3 km“) und Alter der Daten.
 */
export const PracticeCard = memo(function PracticeCard({
  item,
  onPress,
  variant = 'row',
  testID,
}: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const { t, locale } = useT();
  const now = useNow(60_000);
  const { practice, status, nextSlot, distanceM, lastSyncedAt, openCount } = item;
  const specialty = specialtyById(practice.specialtyIds[0] ?? 1);
  const specialtyName = specialty ? t(`specialty.${specialty.slug}`) : '';
  const distance = formatDistance(distanceM, t, locale);
  const when = nextSlot ? formatSlotWhen(nextSlot.startsAt, now, t, locale) : null;
  const nextLine = when
    ? distance
      ? t('card.nextSlot', { when, distance })
      : when
    : status === 'unknown'
      ? t('card.callForAppointment')
      : t('card.noSlotInWindow');
  const statusText = t(`status.${status}`);

  return (
    <Card
      onPress={onPress ? () => onPress(practice.id) : undefined}
      style={variant === 'compact' ? styles.compact : undefined}
      testID={testID}
      // Eine Ansage mit allem, was die Karte zeigt – in derselben Reihenfolge, der Name zuerst.
      accessibilityLabel={[
        practice.name,
        specialtyName,
        status === 'free' || status === 'few'
          ? t('card.openSlots', { count: openCount })
          : statusText,
        practice.offersVideo ? t('service.video_consultation') : null,
        nextLine,
        distance && !when ? distance : null,
        t('time.updatedA11y', { age: freshnessText(t, lastSyncedAt, now) }),
        practice.rating
          ? t('card.ratingA11y', {
              value: practice.rating.average,
              count: practice.rating.count,
            })
          : null,
        practice.isDemo ? t('app.demoBadgeA11y') : null,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <View style={styles.header}>
        <Avatar
          name={practice.name}
          size={variant === 'compact' ? 44 : 48}
          photoUrl={practice.photoUrl}
          blurhash={practice.photoBlurhash}
        />
        <View style={styles.titles}>
          <Text variant="h3" numberOfLines={variant === 'compact' ? 2 : undefined}>
            {practice.name}
          </Text>
          <Text variant="small" color="textSecondary">
            {specialtyName}
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <StatusBadge
          status={status}
          label={
            status === 'free' || status === 'few'
              ? t('card.openSlots', { count: openCount })
              : undefined
          }
        />
        {practice.offersVideo ? (
          <View style={styles.meta}>
            <Video size={14} color={theme.colors.textSecondary} strokeWidth={2} />
            <Text variant="caption" color="textSecondary">
              {t('card.video')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.next}>
        <MapPin size={16} color={theme.colors.primary} strokeWidth={2} />
        <Text variant="bodyStrong" style={styles.nextText}>
          {nextLine}
        </Text>
      </View>

      <View style={styles.footer}>
        <FreshnessLabel lastSyncedAt={lastSyncedAt} />
        <View style={styles.footerRight}>
          {practice.rating ? (
            <View
              style={styles.meta}
              accessibilityLabel={t('card.ratingA11y', {
                value: practice.rating.average,
                count: practice.rating.count,
              })}
            >
              <Star
                size={12}
                color={theme.colors.statusFew}
                fill={theme.colors.statusFew}
                strokeWidth={2}
              />
              <Text variant="caption" color="textSecondary">
                {new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(
                  practice.rating.average,
                )}
              </Text>
            </View>
          ) : null}
          {practice.isDemo ? <DemoBadge /> : null}
        </View>
      </View>
    </Card>
  );
});

const useStyles = makeStyles((t) => ({
  compact: { width: 280 },
  header: { flexDirection: 'row', gap: t.space.sm, alignItems: 'flex-start' },
  titles: { flex: 1, gap: 2 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: t.space.xs,
    marginTop: t.space.sm,
  },
  next: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs, marginTop: t.space.sm },
  nextText: { flexShrink: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: t.space.xs,
    marginTop: t.space.sm,
  },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
}));
