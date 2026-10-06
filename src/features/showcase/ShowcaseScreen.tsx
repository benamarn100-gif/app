import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { ArrowRight, Bell, CalendarPlus, MapPin, Moon, Sun } from 'lucide-react-native';

import {
  AnimatedCheck,
  Avatar,
  BottomSheet,
  Button,
  Card,
  Chip,
  DemoBadge,
  EmergencyBar,
  EmptyState,
  FreshnessLabel,
  IllustrationCalendar,
  IllustrationOffline,
  IllustrationPractice,
  IllustrationSearchEmpty,
  IllustrationWaiting,
  IllustrationWelcome,
  ListRow,
  PracticeCard,
  PracticeCardSkeleton,
  ProgressDots,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  SlotChip,
  StatusBadge,
  Text,
  TextField,
  ToastView,
  useToast,
  type BottomSheetRef,
} from '@/components';
import { demoCity } from '@/config/env';
import { FixedThemeProvider, makeStyles, useTheme } from '@/design/theme';
import type { ColorScheme, TypeVariant } from '@/design/tokens';
import { generateDirectory } from '@/domain/seed/generator';
import type { PracticeAvailability } from '@/domain/types';
import { useT } from '@/i18n/useT';

/** Komponenten-Showcase (nur Entwicklung): alle Bausteine mit ihren Zuständen, hell und dunkel. */
export function ShowcaseScreen() {
  const [scheme, setScheme] = useState<ColorScheme>('light');
  const { t } = useT();
  return (
    <FixedThemeProvider scheme={scheme}>
      <ShowcaseContent scheme={scheme} onScheme={setScheme} t={t} />
    </FixedThemeProvider>
  );
}

function ShowcaseContent({
  scheme,
  onScheme,
  t,
}: {
  scheme: ColorScheme;
  onScheme: (s: ColorScheme) => void;
  t: ReturnType<typeof useT>['t'];
}) {
  const theme = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const sheet = useRef<BottomSheetRef>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chips, setChips] = useState<number[]>([1]);
  const [slot, setSlot] = useState('09:30');
  const [query, setQuery] = useState('');
  const [toggle, setToggle] = useState(true);
  const [seg, setSeg] = useState<'map' | 'list'>('list');
  const now = useMemo(() => new Date(), []);

  const samples = useMemo<PracticeAvailability[]>(() => {
    const dir = generateDirectory(demoCity);
    const base = (i: number) => dir.practices[i]!;
    const nextSlot = (minutes: number) => ({
      id: `s${minutes}`,
      doctorId: 'd',
      practiceId: base(0).id,
      startsAt: new Date(now.getTime() + minutes * 60000).toISOString(),
      endsAt: new Date(now.getTime() + (minutes + 15) * 60000).toISOString(),
      status: 'open' as const,
      heldUntil: null,
      holdReason: null,
      visitType: 'in_person' as const,
      updatedAt: now.toISOString(),
    });
    const synced = new Date(now.getTime() - 7 * 60000).toISOString();
    return [
      {
        practice: base(0),
        status: 'free',
        openCount: 5,
        nextSlot: nextSlot(95),
        distanceM: 2300,
        lastSyncedAt: synced,
      },
      {
        practice: base(15),
        status: 'few',
        openCount: 1,
        nextSlot: nextSlot(60 * 26),
        distanceM: 850,
        lastSyncedAt: synced,
      },
      {
        practice: base(22),
        status: 'booked',
        openCount: 0,
        nextSlot: null,
        distanceM: 4100,
        lastSyncedAt: synced,
      },
      {
        practice: base(31),
        status: 'unknown',
        openCount: 0,
        nextSlot: null,
        distanceM: 6200,
        lastSyncedAt: new Date(now.getTime() - 30 * 3600 * 1000).toISOString(),
      },
    ];
  }, [now]);

  const types: TypeVariant[] = [
    'display',
    'h1',
    'h2',
    'h3',
    'body',
    'bodyStrong',
    'small',
    'caption',
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} testID="showcase">
        <SegmentedControl
          accessibilityLabel={t('profile.appearance')}
          value={scheme}
          onChange={onScheme}
          options={[
            { value: 'light', label: t('showcase.light'), icon: Sun },
            { value: 'dark', label: t('showcase.dark'), icon: Moon },
          ]}
          testID="showcase-scheme"
        />

        <SectionHeader title={t('showcase.typography')} />
        <View style={styles.stack}>
          {types.map((v) => (
            <Text key={v} variant={v}>
              {v} · {t('showcase.typeSample')}
            </Text>
          ))}
          <Text variant="body" color="textSecondary">
            textSecondary · {t('app.tagline')}
          </Text>
        </View>

        <SectionHeader title={t('showcase.buttons')} />
        <View style={styles.stack}>
          <Button
            label={t('showcase.primary')}
            icon={CalendarPlus}
            onPress={() => toast.show(t('showcase.toastSample'), 'success')}
          />
          <Button
            label={t('showcase.secondary')}
            variant="secondary"
            icon={MapPin}
            onPress={() => undefined}
          />
          <Button
            label={t('showcase.text')}
            variant="text"
            icon={ArrowRight}
            iconPosition="right"
            onPress={() => undefined}
          />
          <Button label={t('showcase.disabled')} disabled />
          <Button label={t('showcase.loading')} loading />
          <Button label={t('common.retry')} variant="secondary" error onPress={() => undefined} />
        </View>

        <SectionHeader title={t('showcase.chips')} />
        <View style={styles.wrap}>
          {[1, 3, 5, 9].map((id, i) => (
            <Chip
              key={id}
              label={t(
                `specialtyShort.${['allgemeinmedizin', 'kinder-jugendmedizin', 'hno', 'zahnmedizin'][i] as 'hno'}`,
              )}
              selected={chips.includes(id)}
              onPress={() =>
                setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
              }
            />
          ))}
          <Chip label={t('showcase.disabled')} disabled />
        </View>
        <SegmentedControl
          accessibilityLabel={t('search.viewToggleA11y')}
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'map', label: t('search.map') },
            { value: 'list', label: t('search.list') },
          ]}
        />

        <SectionHeader title={t('showcase.status')} />
        <View style={styles.wrap}>
          <StatusBadge status="free" />
          <StatusBadge status="few" />
          <StatusBadge status="booked" />
          <StatusBadge status="unknown" />
          <StatusBadge status="free" size="sm" />
        </View>
        <View style={styles.wrap}>
          <FreshnessLabel lastSyncedAt={new Date(now.getTime() - 4 * 60000).toISOString()} />
          <FreshnessLabel lastSyncedAt={new Date(now.getTime() - 30 * 3600 * 1000).toISOString()} />
          <DemoBadge />
        </View>

        <SectionHeader title={t('showcase.slots')} />
        <View style={styles.wrap}>
          {['08:15', '09:30', '11:00', '14:45'].map((time) => (
            <SlotChip
              key={time}
              time={time}
              selected={slot === time}
              onPress={() => setSlot(time)}
              video={time === '14:45'}
            />
          ))}
          <SlotChip time="16:00" disabled />
        </View>

        <SectionHeader title={t('showcase.cards')} />
        <View style={styles.stack}>
          {samples.map((item) => (
            <PracticeCard key={item.practice.id} item={item} onPress={() => undefined} />
          ))}
          <PracticeCardSkeleton />
          <Skeleton height={14} width="60%" />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hList}
        >
          {samples.slice(0, 2).map((item) => (
            <PracticeCard
              key={item.practice.id}
              item={item}
              variant="compact"
              onPress={() => undefined}
            />
          ))}
        </ScrollView>
        <View style={styles.wrap}>
          <Avatar name="Hausarztpraxis am Lindenhof" />
          <Avatar name="Dr. med. Lea Brandt" size={64} />
          <Avatar name="Kinderarztpraxis Sternwiese" size={40} />
        </View>

        <SectionHeader title={t('showcase.inputs')} />
        <View style={styles.stack}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            label={t('search.placeholder')}
            placeholder={t('search.placeholder')}
          />
          <TextField
            label={t('onboarding.location.postalCodeLabel')}
            placeholder={t('onboarding.location.postalCodePlaceholder')}
            keyboardType="number-pad"
          />
          <TextField
            label={t('booking.phone')}
            defaultValue="0661"
            error={t('showcase.inputError')}
          />
          <TextField label={t('booking.email')} hint={t('booking.verifyBody')} disabled />
        </View>

        <SectionHeader title={t('showcase.feedback')} />
        <View style={styles.stack}>
          <ProgressDots total={3} current={1} />
          <ToastView
            item={{ kind: 'success', message: t('showcase.toastSample') }}
            onDismiss={() => undefined}
          />
          <ToastView
            item={{ kind: 'error', message: t('errors.network') }}
            onDismiss={() => undefined}
          />
          <Button
            label={t('showcase.toastError')}
            variant="secondary"
            onPress={() => toast.show(t('errors.generic'), 'error')}
          />
          <EmergencyBar />
          <Card tone="muted">
            <ListRow
              title={t('profile.reminders')}
              icon={Bell}
              switchValue={toggle}
              onSwitch={setToggle}
            />
            <ListRow
              title={t('profile.privacyCenter')}
              value={t('common.on')}
              onPress={() => undefined}
            />
          </Card>
          <EmptyState
            illustration={<IllustrationSearchEmpty size={120} />}
            title={t('empty.radius', { radius: 10 })}
            primaryAction={{
              label: t('empty.radiusAction', { radius: 25 }),
              onPress: () => undefined,
            }}
            secondaryAction={{ label: t('empty.waitlistAction'), onPress: () => undefined }}
          />
          <View style={styles.center}>
            <AnimatedCheck size={96} />
          </View>
          <Button
            label={t('showcase.sheet')}
            variant="secondary"
            onPress={() => setSheetOpen(true)}
          />
        </View>

        <SectionHeader title={t('showcase.illustrations')} />
        <View style={styles.wrap}>
          <IllustrationWelcome size={110} />
          <IllustrationCalendar size={110} />
          <IllustrationSearchEmpty size={110} />
          <IllustrationWaiting size={110} />
          <IllustrationOffline size={110} />
          <IllustrationPractice size={110} />
        </View>
      </ScrollView>

      {sheetOpen ? (
        <BottomSheet
          ref={sheet}
          index={1}
          backdrop
          persistent={false}
          onChange={(i) => i === -1 && setSheetOpen(false)}
        >
          <BottomSheetView style={styles.sheet}>
            <Text variant="h3">{t('showcase.sheet')}</Text>
            <Text variant="body" color="textSecondary">
              {t('showcase.sheetBody')}
            </Text>
            <Button
              label={t('common.close')}
              variant="secondary"
              onPress={() => sheet.current?.close()}
            />
          </BottomSheetView>
        </BottomSheet>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1 },
  content: { padding: t.space.md, gap: t.space.lg, paddingBottom: t.space.huge },
  stack: { gap: t.space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs, alignItems: 'center' },
  hList: { gap: t.space.sm, paddingVertical: t.space.xs },
  center: { alignItems: 'center' },
  sheet: { padding: t.space.lg, gap: t.space.md, ...StyleSheet.flatten({}) },
}));
