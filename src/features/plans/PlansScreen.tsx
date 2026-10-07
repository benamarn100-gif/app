import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, PressableScale, Text, useToast } from '@/components';
import { Check, Sparkles } from '@/components/icons';
import { useRepository } from '@/data/DataProvider';
import { makeStyles, useTheme } from '@/design/theme';
import type { PlanId } from '@/domain/plans';
import { formatBerlinDate } from '@/domain/time/berlin';
import { useT } from '@/i18n/useT';
import { getBilling, scheduleTrialReminder, type Offer } from '@/lib/billing';
import { haptics } from '@/lib/haptics';

import { usePlan } from './usePlan';

export type PaywallReason =
  | 'alarms'
  | 'longAlarms'
  | 'calendar'
  | 'favorites'
  | 'checkups'
  | 'familyCheckups'
  | 'profiles'
  | 'overview';

const REASONS: readonly PaywallReason[] = [
  'alarms',
  'longAlarms',
  'calendar',
  'favorites',
  'checkups',
  'familyCheckups',
  'profiles',
  'overview',
];

/** Gründe, für die nur „Familie“ hilft */
const FAMILY_ONLY: readonly PaywallReason[] = ['familyCheckups', 'profiles'];

/**
 * Bezahlseite (Phase 4) nach den Regeln aus dem Abo-Konzept:
 * Gesamtpreis zuerst und groß, Monatswert nur klein; nichts vorausgewählt; „Jetzt nicht“ so
 * groß wie die Kaufoptionen; Kauf wiederherstellen, Bedingungen und Datenschutz verlinkt;
 * ein Satz zum Kündigen; keine Countdowns, keine erfundenen Rabatte, keine roten Warnfarben.
 * Fairness: Bezahlen verschafft keinen Vorrang.
 * Nie gezeigt in: Akut/„Heute“, Notfall, Buchungsablauf, Start/Einführung, Fehlerseiten.
 */
export function PlansScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const toast = useToast();
  const repo = useRepository();
  const billing = getBilling(repo);
  const current = usePlan();
  const params = useLocalSearchParams<{ reason?: string }>();
  const reason: PaywallReason = REASONS.includes(params.reason as PaywallReason)
    ? (params.reason as PaywallReason)
    : 'overview';
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void billing
      .loadOffers(locale)
      .then((o) => alive && setOffers(o))
      .catch(() => alive && setOffers([]));
    return () => {
      alive = false;
    };
  }, [billing, locale]);

  const visible = (offers ?? []).filter((o) =>
    FAMILY_ONLY.includes(reason) ? o.plan === 'family' : true,
  );
  const unavailable = billing.kind === 'unavailable';

  const buy = async (offer: Offer) => {
    setBusy(offer.id);
    try {
      const result = await billing.purchase(offer.id);
      if (result === 'cancelled') return;
      haptics.success();
      await current.refresh();
      const local = await billing.localPlan().catch(() => null);
      if (local?.trial && local.expiresAt) await scheduleTrialReminder(local.expiresAt, t);
      toast.show(t('plans.thanks', { plan: t(`plans.name.${offer.plan}`) }), 'success');
      router.back();
    } catch {
      toast.show(t('plans.purchaseFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      await billing.restore();
      await current.refresh();
      toast.show(t('plans.restored'), 'info');
    } catch {
      toast.show(t('plans.purchaseFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View
      style={[styles.root, { paddingBottom: Math.max(insets.bottom, 16) }]}
      testID="plans-screen"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Sparkles size={28} color={theme.colors.primary} strokeWidth={2} />
          <Text variant="h2" accessibilityRole="header">
            {t(`plans.reason.${reason}.title`)}
          </Text>
          <Text variant="body" color="textSecondary">
            {t(`plans.reason.${reason}.body`)}
          </Text>
        </View>

        {current.plan !== 'free' ? (
          <Card tone="muted" style={styles.gap}>
            <Text variant="bodyStrong">
              {current.expiresAt
                ? t('plans.currentUntil', {
                    plan: t(`plans.name.${current.plan}`),
                    date: formatBerlinDate(current.expiresAt, locale, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }),
                  })
                : t('plans.current', { plan: t(`plans.name.${current.plan}`) })}
            </Text>
            <Button
              variant="secondary"
              label={billing.kind === 'demo' ? t('plans.demoEnd') : t('plans.manage')}
              onPress={async () => {
                await billing.manage();
                await current.refresh();
              }}
              testID="plans-manage"
            />
          </Card>
        ) : null}

        <PlanSummary plan="free" offers={offers} />
        <PlanSummary plan="plus" offers={offers} highlight={!FAMILY_ONLY.includes(reason)} />
        <PlanSummary plan="family" offers={offers} highlight={FAMILY_ONLY.includes(reason)} />

        <Card tone="muted">
          <Text variant="small">{t('plans.fairness')}</Text>
        </Card>

        {billing.kind === 'demo' ? (
          <Card tone="accent">
            <Text variant="small">{t('plans.demoNotice')}</Text>
          </Card>
        ) : null}
        {unavailable ? (
          <Card tone="muted">
            <Text variant="small">{t('plans.unavailable')}</Text>
          </Card>
        ) : null}

        {/* Kaufoptionen: nichts vorausgewählt, jede Option eine eigene Taste */}
        <View style={styles.gap} accessibilityRole="list">
          {visible.map((offer) => (
            <PressableScale
              key={offer.id}
              onPress={() => void buy(offer)}
              disabled={unavailable || busy !== null}
              accessibilityRole="button"
              accessibilityLabel={[
                t(`plans.offer.${offer.id}`),
                offer.kind === 'pass'
                  ? t('plans.passPrice', { price: offer.price })
                  : t('plans.yearPrice', { price: offer.price }),
                offer.trialDays ? t('plans.trial', { count: offer.trialDays }) : null,
                offer.kind === 'pass' ? t('plans.passEnds') : null,
              ]
                .filter(Boolean)
                .join(', ')}
              accessibilityState={{ busy: busy === offer.id, disabled: unavailable }}
              style={[styles.offer, unavailable && styles.disabled]}
              testID={`buy-${offer.id}`}
            >
              <Text variant="bodyStrong">{t(`plans.offer.${offer.id}`)}</Text>
              <Text variant="h2">
                {offer.kind === 'pass'
                  ? t('plans.passPrice', { price: offer.price })
                  : t('plans.yearPrice', { price: offer.price })}
              </Text>
              <Text variant="small" color="textSecondary">
                {[
                  offer.perMonth ? t('plans.perMonth', { price: offer.perMonth }) : null,
                  offer.trialDays ? t('plans.trial', { count: offer.trialDays }) : null,
                  offer.kind === 'pass' ? t('plans.passEnds') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </PressableScale>
          ))}
        </View>

        <Text variant="small" color="textSecondary">
          {t('plans.cancelInfo')}
        </Text>
        <View style={styles.links}>
          <Button
            variant="text"
            label={t('plans.restore')}
            loading={busy === 'restore'}
            onPress={() => void restore()}
            testID="plans-restore"
          />
          <Button
            variant="text"
            label={t('profile.terms')}
            onPress={() => router.push('/settings/legal/terms')}
          />
          <Button
            variant="text"
            label={t('profile.privacyPolicy')}
            onPress={() => router.push('/settings/legal/privacy')}
          />
        </View>
      </ScrollView>
      {/* „Jetzt nicht“ so groß wie die Kaufoptionen */}
      <View style={styles.footer}>
        <Button
          variant="secondary"
          label={t('plans.notNow')}
          onPress={() => router.back()}
          fullWidth
          testID="plans-not-now"
        />
      </View>
    </View>
  );
}

function PlanSummary({
  plan,
  offers,
  highlight,
}: {
  plan: PlanId;
  offers: Offer[] | null;
  highlight?: boolean;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const items = t(`plans.includes.${plan}`).split('\n');
  // Preise schon in der Übersicht – nicht erst nach dem Scrollen zu den Kaufoptionen
  const price =
    plan === 'free'
      ? t('plans.freePrice')
      : (offers ?? [])
          .filter((o) => o.plan === plan)
          .map((o) =>
            o.kind === 'pass'
              ? t('plans.passPriceShort', { price: o.price })
              : t('plans.yearPrice', { price: o.price }),
          )
          .join(' · ');
  return (
    <Card tone={highlight ? 'primary' : 'surface'} style={styles.gap} testID={`plan-${plan}`}>
      <Text variant="h3">{t(`plans.name.${plan}`)}</Text>
      {price ? <Text variant="bodyStrong">{price}</Text> : null}
      {items.map((line) => (
        <View key={line} style={styles.item}>
          <Check size={18} color={theme.colors.primary} strokeWidth={2.5} />
          <Text variant="small" style={styles.flex}>
            {line}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.surface },
  content: { padding: t.space.lg, gap: t.space.md },
  header: { gap: t.space.xs },
  gap: { gap: t.space.xs },
  item: { flexDirection: 'row', gap: t.space.xs, alignItems: 'flex-start' },
  flex: { flex: 1 },
  offer: {
    gap: 2,
    padding: t.space.md,
    borderRadius: t.radius.lg,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surface,
    minHeight: t.layout.touchTarget,
  },
  disabled: { opacity: 0.5 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs },
  footer: {
    paddingTop: t.space.sm,
    paddingHorizontal: t.space.lg,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
}));
