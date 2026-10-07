import { ScrollView, View } from 'react-native';

import { Avatar, Card, Chip, PressableScale, Skeleton, Stagger, Text } from '@/components';
import { Trash } from '@/components/icons';
import { useDependents, useRemoveDependent } from '@/data/hooks';
import { makeStyles, useTheme } from '@/design/theme';
import { PatientPicker } from '@/features/booking/PatientPicker';
import type { AgeGroup } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { usePreferences } from '@/state/preferences';

const SELF_GROUPS: AgeGroup[] = ['teen_13_17', 'adult_18_39', 'adult_40_64', 'senior_65_plus'];

/**
 * Familienprofile (Feature 5): „Ich“ mit eigener Altersgruppe plus Familienmitglieder – nur
 * Spitzname + Altersgruppe (Datensparsamkeit), auf dem Server verschlüsselt. Die Altersgruppe
 * passt Suche (Fachrichtungen) und Vorsorge-Übersicht automatisch an.
 */
export function FamilyScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const dependents = useDependents();
  const remove = useRemoveDependent();
  const selfAgeGroup = usePreferences((s) => s.selfAgeGroup);
  const setPrefs = usePreferences((s) => s.set);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text variant="body" color="textSecondary">
        {t('profile.familyHint')}
      </Text>
      <Card>
        <View style={styles.row}>
          <Avatar name={t('booking.patientSelf')} size={40} />
          <Text variant="bodyStrong" style={styles.flex}>
            {t('profile.selfAge')}
          </Text>
        </View>
        <View
          style={styles.wrap}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('profile.selfAge')}
        >
          {SELF_GROUPS.map((g) => (
            <Chip
              key={g}
              role="radio"
              label={t(`ageGroup.${g}`)}
              selected={selfAgeGroup === g}
              onPress={() => setPrefs({ selfAgeGroup: selfAgeGroup === g ? null : g })}
              testID={`self-age-${g}`}
            />
          ))}
        </View>
      </Card>
      {dependents.isLoading ? (
        <Skeleton height={80} />
      ) : (dependents.data ?? []).length === 0 ? (
        <Text variant="body" color="textSecondary">
          {t('profile.familyEmpty')}
        </Text>
      ) : (
        (dependents.data ?? []).map((d, i) => (
          <Stagger key={d.id} index={i} animateLayout>
            <Card>
              <View style={styles.row}>
                <Avatar name={d.label} size={40} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{d.label}</Text>
                  <Text variant="small" color="textSecondary">
                    {t(`ageGroup.${d.ageGroup}`)}
                  </Text>
                </View>
                <PressableScale
                  onPress={() => remove.mutate(d.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('common.delete')}: ${d.label}`}
                  style={styles.remove}
                >
                  <Trash size={20} color={theme.colors.statusBooked} strokeWidth={2} />
                </PressableScale>
              </View>
            </Card>
          </Stagger>
        ))
      )}
      <PatientPicker value={null} onChange={() => undefined} context="family" />
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: { padding: t.layout.screenPadding, gap: t.space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs, marginTop: t.space.sm },
  flex: { flex: 1 },
  remove: {
    width: t.layout.touchTarget,
    height: t.layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
