import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Text, TextField, useToast } from '@/components';
import { UserPlus } from '@/components/icons';
import { useAddDependent, useDependents } from '@/data/hooks';
import { makeStyles } from '@/design/theme';
import { AGE_GROUPS, type AgeGroup } from '@/domain/types';
import { isAppError } from '@/data/repository';
import { openPlans } from '@/features/plans/openPlans';
import { usePlan } from '@/features/plans/usePlan';
import { useT } from '@/i18n/useT';

type Props = {
  value: string | null;
  onChange: (dependentId: string | null) => void;
  /** booking: keine Bezahlseite im Buchungsablauf (Tabuzone) – nur ein sachlicher Hinweis */
  context?: 'booking' | 'family';
};

/** Für wen ist der Termin? Ich oder ein Familienmitglied (nur Spitzname + Altersgruppe). */
export function PatientPicker({ value, onChange, context = 'booking' }: Props) {
  const styles = useStyles();
  const { t } = useT();
  const toast = useToast();
  const dependents = useDependents();
  const add = useAddDependent();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('child_0_5');
  const { limits } = usePlan();
  // Profile inkl. „Ich“: kostenlos/Plus 2, Familie 5 – der Server prüft dasselbe
  const atLimit = (dependents.data ?? []).length + 1 >= limits.profiles;

  return (
    <View style={styles.container}>
      <View
        style={styles.wrap}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('booking.patientTitle')}
      >
        <Chip
          role="radio"
          size="lg"
          label={t('booking.patientSelf')}
          selected={value === null}
          onPress={() => onChange(null)}
          testID="patient-self"
        />
        {(dependents.data ?? []).map((d) => (
          <Chip
            key={d.id}
            role="radio"
            size="lg"
            label={d.label}
            selected={value === d.id}
            onPress={() => onChange(d.id)}
          />
        ))}
      </View>
      {adding ? (
        <View style={styles.form}>
          <TextField
            label={t('booking.dependentName')}
            hint={t('booking.dependentNameHint')}
            value={label}
            onChangeText={setLabel}
            maxLength={40}
            autoCapitalize="words"
          />
          <Text variant="smallStrong">{t('onboarding.forWhom.ageGroup')}</Text>
          <View style={styles.wrap} accessibilityRole="radiogroup">
            {AGE_GROUPS.map((g) => (
              <Chip
                key={g}
                role="radio"
                label={t(`ageGroup.${g}`)}
                selected={ageGroup === g}
                onPress={() => setAgeGroup(g)}
              />
            ))}
          </View>
          <Button
            variant="secondary"
            label={t('common.add')}
            disabled={label.trim().length === 0}
            loading={add.isPending}
            onPress={async () => {
              try {
                const dep = await add.mutateAsync({ label, ageGroup });
                onChange(dep.id);
                setAdding(false);
                setLabel('');
              } catch (e) {
                if (isAppError(e, 'plan_limit') && context === 'family') openPlans('profiles');
                else
                  toast.show(
                    t(isAppError(e, 'plan_limit') ? 'family.limit' : 'errors.generic'),
                    'info',
                  );
              }
            }}
          />
        </View>
      ) : atLimit && context === 'booking' ? (
        <Text variant="small" color="textSecondary" testID="profiles-limit-hint">
          {t('family.limit')}
        </Text>
      ) : (
        <Button
          variant="text"
          icon={UserPlus}
          label={t('booking.addDependent')}
          onPress={() => (atLimit ? openPlans('profiles') : setAdding(true))}
          style={styles.addButton}
          testID="add-dependent"
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: { gap: t.space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs },
  form: { gap: t.space.sm },
  addButton: { alignSelf: 'flex-start' },
}));
