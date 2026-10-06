import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Divider, ListRow, PressableScale, SpecialtyIcon, Text } from '@/components';
import { useAvailabilitySearch } from '@/data/hooks';
import { makeStyles, useTheme } from '@/design/theme';
import { SPECIALTIES } from '@/domain/seed/catalog';
import { ACCESSIBILITY_FEATURES, type AccessibilityFeature, type TimeWindow } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { RADIUS_STEPS, useSearchFilters } from '@/state/searchFilters';

import { useFilteredSearchParams } from './useSearchParams';

const LANGUAGES = ['en', 'tr', 'ru', 'ar', 'pl', 'uk', 'fr', 'es'] as const;
const FILTERABLE_A11Y: AccessibilityFeature[] = ACCESSIBILITY_FEATURES.filter(
  (f) => f !== 'parking',
);

/**
 * Filter-Sheet: Fachrichtung, Umkreis 1–50 km, Zeitraum, Sprache, Barrierefreiheit,
 * gesetzlich/privat, Videosprechstunde. Der Button zeigt live die Trefferzahl.
 */
export function FiltersScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const f = useSearchFilters();
  const { params } = useFilteredSearchParams();
  const preview = useAvailabilitySearch(params);
  const count = preview.data?.length ?? 0;

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  const radiusIndex = RADIUS_STEPS.findIndex((r) => r >= f.radiusKm);
  const stepRadius = (dir: -1 | 1) => {
    const idx = Math.min(
      RADIUS_STEPS.length - 1,
      Math.max(0, (radiusIndex < 0 ? RADIUS_STEPS.length - 1 : radiusIndex) + dir),
    );
    f.set({ radiusKm: RADIUS_STEPS[idx] });
  };

  return (
    <View style={styles.root} testID="filters">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text variant="h2">{t('filters.title')}</Text>
          <Button
            variant="text"
            label={t('filters.reset')}
            onPress={() => f.reset(10)}
            testID="reset-filters"
          />
        </View>

        <Section title={t('filters.specialty')}>
          <View style={styles.wrap}>
            <Chip
              label={t('filters.allSpecialties')}
              selected={f.specialtyIds.length === 0}
              onPress={() => f.set({ specialtyIds: [] })}
            />
            {SPECIALTIES.map((s) => (
              <Chip
                key={s.id}
                label={t(`specialtyShort.${s.slug}`)}
                icon={(p) => <SpecialtyIcon slug={s.slug} {...p} />}
                selected={f.specialtyIds.includes(s.id)}
                onPress={() => f.set({ specialtyIds: toggle(f.specialtyIds, s.id) })}
                testID={`filter-specialty-${s.slug}`}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.radius')}>
          <View
            style={styles.stepper}
            accessibilityRole="adjustable"
            accessibilityLabel={t('filters.radius')}
            accessibilityValue={{ text: t('filters.radiusValue', { value: f.radiusKm }) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) =>
              stepRadius(e.nativeEvent.actionName === 'increment' ? 1 : -1)
            }
          >
            <PressableScale
              onPress={() => stepRadius(-1)}
              accessibilityRole="button"
              accessibilityLabel={t('filters.decreaseRadius')}
              disabled={f.radiusKm <= RADIUS_STEPS[0]}
              style={styles.stepButton}
            >
              <Minus size={20} color={theme.colors.primary} strokeWidth={2.5} />
            </PressableScale>
            <Text variant="h3" style={styles.stepValue} accessible={false}>
              {t('filters.radiusValue', { value: f.radiusKm })}
            </Text>
            <PressableScale
              onPress={() => stepRadius(1)}
              accessibilityRole="button"
              accessibilityLabel={t('filters.increaseRadius')}
              disabled={f.radiusKm >= RADIUS_STEPS[RADIUS_STEPS.length - 1]!}
              style={styles.stepButton}
              testID="radius-increase"
            >
              <Plus size={20} color={theme.colors.primary} strokeWidth={2.5} />
            </PressableScale>
          </View>
          <View style={styles.wrap}>
            {RADIUS_STEPS.map((r) => (
              <Chip
                key={r}
                role="radio"
                label={t('filters.radiusValue', { value: r })}
                selected={f.radiusKm === r}
                onPress={() => f.set({ radiusKm: r })}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.window')}>
          <View style={styles.wrap} accessibilityRole="radiogroup">
            {(['today', 'tomorrow', 'week'] as TimeWindow[]).map((w) => (
              <Chip
                key={w}
                role="radio"
                label={t(
                  w === 'today'
                    ? 'time.today'
                    : w === 'tomorrow'
                      ? 'time.tomorrow'
                      : 'time.thisWeek',
                )}
                selected={f.window === w}
                onPress={() => f.set({ window: w })}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.language')}>
          <View style={styles.wrap}>
            {LANGUAGES.map((l) => (
              <Chip
                key={l}
                label={t(`languageName.${l}`)}
                selected={f.languages.includes(l)}
                onPress={() => f.set({ languages: toggle(f.languages, l) })}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.accessibility')}>
          <View style={styles.wrap}>
            {FILTERABLE_A11Y.map((feature) => (
              <Chip
                key={feature}
                label={t(`a11yFeature.${feature}`)}
                selected={f.accessibility.includes(feature)}
                onPress={() => f.set({ accessibility: toggle(f.accessibility, feature) })}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.insurance')}>
          <View style={styles.wrap} accessibilityRole="radiogroup">
            {(['any', 'public', 'private'] as const).map((value) => (
              <Chip
                key={value}
                role="radio"
                label={t(
                  value === 'any'
                    ? 'filters.insuranceAny'
                    : value === 'public'
                      ? 'filters.insurancePublic'
                      : 'filters.insurancePrivate',
                )}
                selected={f.insurance === value}
                onPress={() => f.set({ insurance: value })}
              />
            ))}
          </View>
        </Section>

        <Divider />
        <ListRow
          title={t('filters.video')}
          subtitle={t('filters.videoOnly')}
          switchValue={f.videoOnly}
          onSwitch={(v) => f.set({ videoOnly: v })}
        />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Button
          label={count > 0 ? t('filters.apply', { count }) : t('filters.applyNone')}
          loading={preview.isFetching && !preview.data}
          onPress={() => router.back()}
          testID="apply-filters"
        />
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text variant="h3">{title}</Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.surface },
  content: { padding: t.space.lg, gap: t.space.xl, paddingBottom: t.space.xxxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: t.space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: t.space.md },
  stepButton: {
    width: t.layout.touchTarget,
    height: t.layout.touchTarget,
    borderRadius: t.layout.touchTarget / 2,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { minWidth: 72, textAlign: 'center' },
  footer: {
    paddingHorizontal: t.space.lg,
    paddingTop: t.space.sm,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
}));
