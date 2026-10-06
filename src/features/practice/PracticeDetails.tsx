import { View } from 'react-native';

import { Avatar, Card, FreshnessLabel, Text } from '@/components';
import { Accessibility, Check, Languages, ShieldCheck, Star } from '@/components/icons';
import { makeStyles, useTheme } from '@/design/theme';
import { specialtyById } from '@/domain/seed/catalog';
import { ACCESSIBILITY_FEATURES, WEEKDAYS, type Doctor, type Practice } from '@/domain/types';
import { useT } from '@/i18n/useT';

export function OpeningHours({ practice }: { practice: Practice }) {
  const styles = useStyles();
  const { t } = useT();
  return (
    <View style={styles.table}>
      {WEEKDAYS.map((day) => {
        const periods = practice.openingHours[day] ?? [];
        return (
          <View
            key={day}
            style={styles.tableRow}
            accessible
            accessibilityLabel={`${t(`weekday.${day}`)}: ${periods.length ? periods.map((p) => `${p.open}–${p.close}`).join(', ') : t('practice.closed')}`}
          >
            <Text variant="small" style={styles.dayCol}>
              {t(`weekday.${day}`)}
            </Text>
            <Text
              variant="small"
              color={periods.length ? 'textPrimary' : 'textSecondary'}
              style={styles.flex}
            >
              {periods.length
                ? periods.map((p) => `${p.open}–${p.close}`).join(' · ')
                : t('practice.closed')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function ServicesList({ practice }: { practice: Practice }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  return (
    <View style={styles.list}>
      {practice.services.map((key) => (
        <View key={key} style={styles.item}>
          <Check size={16} color={theme.colors.primary} strokeWidth={2.5} />
          <Text variant="body" style={styles.flex}>
            {t(`service.${key}` as 'service.checkup')}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function AccessibilityInfo({ practice }: { practice: Practice }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const features = ACCESSIBILITY_FEATURES.filter((f) => practice.accessibility[f]);
  if (!features.length) {
    return (
      <Text variant="body" color="textSecondary">
        {t('practice.accessibilityNone')}
      </Text>
    );
  }
  return (
    <View style={styles.list}>
      {features.map((f) => (
        <View key={f} style={styles.item}>
          <Accessibility size={16} color={theme.colors.primary} strokeWidth={2.25} />
          <Text variant="body" style={styles.flex}>
            {t(`a11yFeature.${f}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function LanguagesAndInsurance({ practice }: { practice: Practice }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  return (
    <View style={styles.list}>
      <View style={styles.item}>
        <Languages size={16} color={theme.colors.primary} strokeWidth={2.25} />
        <Text variant="body" style={styles.flex}>
          {practice.languages.map((l) => t(`languageName.${l}` as 'languageName.de')).join(', ')}
        </Text>
      </View>
      <View style={styles.item}>
        <ShieldCheck size={16} color={theme.colors.primary} strokeWidth={2.25} />
        <Text variant="body" style={styles.flex}>
          {!practice.acceptsPublic
            ? t('practice.privateOnly')
            : [
                practice.acceptsPublic && t('practice.acceptsPublic'),
                practice.acceptsPrivate && t('practice.acceptsPrivate'),
              ]
                .filter(Boolean)
                .join(' · ')}
        </Text>
      </View>
    </View>
  );
}

/** Bewertungen: zunächst nur Anzeigestruktur (Durchschnitt + Anzahl), keine Einzeltexte. */
export function Reviews({ practice }: { practice: Practice }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t, locale } = useT();
  return (
    <Card tone="muted">
      {practice.rating ? (
        <View
          style={styles.item}
          accessible
          accessibilityLabel={t('card.ratingA11y', {
            value: practice.rating.average,
            count: practice.rating.count,
          })}
        >
          <Star
            size={18}
            color={theme.colors.statusFew}
            fill={theme.colors.statusFew}
            strokeWidth={2}
          />
          <Text variant="bodyStrong">
            {t('practice.reviewsSummary', {
              value: new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(
                practice.rating.average,
              ),
              count: practice.rating.count,
            })}
          </Text>
        </View>
      ) : (
        <Text variant="body" color="textSecondary">
          {t('practice.reviewsNone')}
        </Text>
      )}
      <Text variant="small" color="textSecondary" style={styles.top}>
        {t('practice.reviewsComingSoon')}
      </Text>
    </Card>
  );
}

export function DoctorsList({ doctors }: { doctors: Doctor[] }) {
  const styles = useStyles();
  const { t } = useT();
  return (
    <View style={styles.list}>
      {doctors.map((d) => {
        const specialty = specialtyById(d.specialtyIds[0] ?? 1);
        return (
          <View key={d.id} style={styles.doctor}>
            <Avatar name={d.name} size={40} photoUrl={d.photoUrl} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{d.name}</Text>
              <Text variant="small" color="textSecondary">
                {specialty ? t(`specialty.${specialty.slug}`) : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function SourceInfo({
  practice,
  lastSyncedAt,
}: {
  practice: Practice;
  lastSyncedAt: string | null;
}) {
  const styles = useStyles();
  const { t } = useT();
  const label =
    practice.source === 'seed'
      ? t('practice.sourceSeed')
      : practice.source === 'osm'
        ? t('practice.sourceOsm')
        : t('practice.sourceDashboard');
  return (
    <View style={styles.list}>
      <Text variant="body">{label}</Text>
      <Text variant="small" color="textSecondary">
        {practice.sourceLicense}
      </Text>
      <FreshnessLabel lastSyncedAt={lastSyncedAt} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  table: { gap: t.space.xxs },
  tableRow: { flexDirection: 'row', gap: t.space.sm, paddingVertical: 2 },
  dayCol: { width: 110 },
  flex: { flex: 1 },
  list: { gap: t.space.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  doctor: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  top: { marginTop: t.space.xs },
}));
