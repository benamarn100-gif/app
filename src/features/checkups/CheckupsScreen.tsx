import { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  Chip,
  SectionHeader,
  Stagger,
  Text,
  useConfirm,
  useToast,
} from '@/components';
import { Bell, BellRing, Check, ShieldPlus } from '@/components/icons';
import { makeStyles, useTheme } from '@/design/theme';
import {
  addMonthsAt10,
  checkupsFor,
  intervalFor,
  reminderKey,
  type Checkup,
  type CheckupAudience,
} from '@/domain/checkups';
import { SELF } from '@/domain/profiles';
import { formatBerlinDate } from '@/domain/time/berlin';
import { openPlans } from '@/features/plans/openPlans';
import { usePlan } from '@/features/plans/usePlan';
import { useProfiles } from '@/features/profile/useProfiles';
import { useT } from '@/i18n/useT';
import { cancelCheckupReminder, scheduleCheckupReminder } from '@/lib/checkupReminders';
import { requestNotificationPermission } from '@/lib/notifications';
import { useCheckups } from '@/state/checkups';

const SECTIONS: { audience: CheckupAudience; key: 'sectionAll' | 'sectionWomen' | 'sectionMen' }[] =
  [
    { audience: 'all', key: 'sectionAll' },
    { audience: 'women', key: 'sectionWomen' },
    { audience: 'men', key: 'sectionMen' },
  ];

/**
 * Vorsorge (Feature 7): was die gesetzliche Krankenversicherung übernimmt – passend zur
 * Altersgruppe des gewählten Profils – mit selbst gewählter Erinnerung.
 * Nur Erinnerungen, keine medizinische Beratung. Gespeichert wird ausschließlich auf dem
 * Gerät und erst nach Einwilligung; Mitteilungen nennen keine Untersuchung.
 */
export function CheckupsScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { profiles, active } = useProfiles();
  const [profileId, setProfileId] = useState(active.id);
  const profile = profiles.find((p) => p.id === profileId) ?? profiles[0]!;
  const items = checkupsFor(profile.ageGroup);
  const consentAt = useCheckups((s) => s.consentAt);
  const clear = useCheckups((s) => s.clear);
  const reminders = useCheckups((s) => s.reminders);
  const confirm = useConfirm();
  const toast = useToast();

  const clearAll = async () => {
    await Promise.all(Object.keys(reminders).map((key) => cancelCheckupReminder(key)));
    clear();
    toast.show(t('checkups.cleared'), 'info');
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      testID="checkups-screen"
    >
      <Text variant="body" color="textSecondary">
        {t('checkups.intro')}
      </Text>

      {profiles.length > 1 ? (
        <View
          style={styles.wrap}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('checkups.forWhom')}
        >
          {profiles.map((p) => (
            <Chip
              key={p.id}
              role="radio"
              label={p.label}
              selected={p.id === profile.id}
              onPress={() => setProfileId(p.id)}
              testID={`checkup-profile-${p.id}`}
            />
          ))}
        </View>
      ) : null}

      {!profile.ageGroup ? (
        <Card tone="muted" style={styles.gap}>
          <Text variant="body">{t('checkups.ageMissing')}</Text>
          <Button
            variant="secondary"
            label={t('checkups.setAge')}
            onPress={() => router.push('/settings/family')}
          />
        </Card>
      ) : null}

      {SECTIONS.map(({ audience, key }) => {
        const list = items.filter((c) => c.audience === audience);
        if (!list.length) return null;
        return (
          <View key={audience} style={styles.section}>
            <SectionHeader title={t(`checkups.${key}`)} />
            {list.map((c, i) => (
              <Stagger key={c.id} index={i} animateLayout>
                <CheckupCard
                  checkup={c}
                  storageKey={reminderKey(profile.id, c.id)}
                  needsConsent={!consentAt}
                  forFamily={profile.id !== SELF}
                  intervalMonths={intervalFor(c, profile.ageGroup)}
                  confirmConsent={() =>
                    confirm({
                      title: t('checkups.consentTitle'),
                      message: t('checkups.consentBody'),
                      cancelLabel: t('common.cancel'),
                      confirmLabel: t('checkups.consentConfirm'),
                    })
                  }
                />
              </Stagger>
            ))}
          </View>
        );
      })}

      <Text variant="small" color="textSecondary">
        {t('checkups.disclaimer')}
      </Text>
      {consentAt ? (
        <Button
          variant="text"
          label={t('checkups.clearAll')}
          onPress={() => void clearAll()}
          testID="checkups-clear"
        />
      ) : null}
    </ScrollView>
  );
}

function CheckupCard({
  checkup,
  storageKey,
  needsConsent,
  confirmConsent,
  forFamily,
  intervalMonths,
}: {
  checkup: Checkup;
  storageKey: string;
  needsConsent: boolean;
  confirmConsent: () => Promise<boolean>;
  forFamily: boolean;
  /** Abstand für diese Altersgruppe (intervalFor) */
  intervalMonths: number | null;
}) {
  const plan = usePlan();
  // Erst sperren, wenn die Stufe bekannt ist – sonst sähen Plus-Nutzer kurz die Bezahlseite
  const locked =
    !plan.isLoading && !plan.can(forFamily ? 'familyCheckupReminders' : 'checkupReminders');
  const theme = useTheme();
  const styles = useStyles();
  const { t, locale } = useT();
  const toast = useToast();
  const reminder = useCheckups((s) => s.reminders[storageKey]);
  const setReminder = useCheckups((s) => s.setReminder);
  const removeReminder = useCheckups((s) => s.removeReminder);
  const setConsent = useCheckups((s) => s.setConsent);
  const [choosing, setChoosing] = useState(false);
  const base = `checkups.items.${checkup.id}` as const;
  const formatDate = (d: Date | string) =>
    formatBerlinDate(d, locale, { day: 'numeric', month: 'long', year: 'numeric' });

  const options = [...new Set([1, 6, 12, ...(intervalMonths ? [intervalMonths] : [])])]
    .filter((m) => intervalMonths !== null || m <= 6)
    .sort((a, b) => a - b);

  const schedule = async (months: number) => {
    // Übersicht kostenlos; Erinnerungen: eigene mit Plus, für Familienprofile mit Familie
    if (locked) {
      openPlans(forFamily ? 'familyCheckups' : 'checkups');
      return;
    }
    if (needsConsent) {
      if (!(await confirmConsent())) return;
      setConsent();
    }
    const due = addMonthsAt10(new Date(), months);
    setReminder(storageKey, { dueAt: due.toISOString() });
    setChoosing(false);
    const granted = Platform.OS !== 'web' && (await requestNotificationPermission());
    if (granted) await scheduleCheckupReminder(storageKey, due, t);
    toast.show(
      granted ? t('checkups.set', { date: formatDate(due) }) : t('checkups.noPush'),
      granted ? 'success' : 'info',
    );
  };

  const markDone = async () => {
    if (intervalMonths === null) {
      await cancelCheckupReminder(storageKey);
      removeReminder(storageKey);
      toast.show(t('checkups.doneOnce'), 'success');
      return;
    }
    const due = addMonthsAt10(new Date(), intervalMonths);
    setReminder(storageKey, { dueAt: due.toISOString() });
    await scheduleCheckupReminder(storageKey, due, t);
    toast.show(t('checkups.doneToast', { date: formatDate(due) }), 'success');
  };

  const remove = async () => {
    await cancelCheckupReminder(storageKey);
    removeReminder(storageKey);
  };

  return (
    <Card style={styles.gap} testID={`checkup-${checkup.id}`}>
      <View style={styles.head}>
        <ShieldPlus size={22} color={theme.colors.primary} strokeWidth={2.25} />
        <Text variant="h3" style={styles.flex}>
          {t(`${base}.title`)}
        </Text>
      </View>
      <Text variant="smallStrong">{t('checkups.who', { value: t(`${base}.who`) })}</Text>
      <Text variant="small" color="textSecondary">
        {t('checkups.often', { value: t(`${base}.often`) })}
      </Text>
      <Text variant="small" color="textSecondary">
        {t(`${base}.about`)}
      </Text>

      {reminder ? (
        <>
          <View style={styles.head}>
            <BellRing size={18} color={theme.colors.primary} strokeWidth={2.25} />
            <Text variant="bodyStrong" color="primary" style={styles.flex}>
              {t('checkups.dueAt', { date: formatDate(reminder.dueAt) })}
            </Text>
          </View>
          <View style={styles.wrap}>
            <Button
              variant="secondary"
              icon={Check}
              label={t('checkups.done')}
              onPress={() => void markDone()}
              testID={`checkup-done-${checkup.id}`}
            />
            <Button variant="text" label={t('checkups.remove')} onPress={() => void remove()} />
          </View>
        </>
      ) : choosing ? (
        <View
          style={styles.wrap}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('checkups.remind')}
        >
          {options.map((m) => (
            <Chip
              key={m}
              role="button"
              label={
                m === 1
                  ? t('checkups.remindIn1')
                  : m === 6
                    ? t('checkups.remindIn6')
                    : m === 12
                      ? t('checkups.remindIn12')
                      : t('checkups.remindInterval', { count: m })
              }
              onPress={() => void schedule(m)}
              testID={`checkup-remind-${checkup.id}-${m}`}
            />
          ))}
        </View>
      ) : (
        <Button
          variant="secondary"
          icon={Bell}
          label={locked ? `${t('checkups.remind')} · ${t('plans.badge')}` : t('checkups.remind')}
          onPress={() => (locked ? void schedule(0) : setChoosing(true))}
          testID={`checkup-remind-${checkup.id}`}
        />
      )}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: {
    padding: t.layout.screenPadding,
    gap: t.space.md,
    maxWidth: t.layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  section: { gap: t.space.sm },
  gap: { gap: t.space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs, alignItems: 'center' },
}));
