import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Text, TextField, useToast } from '@/components';
import { UserPlus } from '@/components/icons';
import { useAddDependent, useDependents } from '@/data/hooks';
import { makeStyles } from '@/design/theme';
import { AGE_GROUPS, type AgeGroup } from '@/domain/types';
import { useT } from '@/i18n/useT';

type Props = { value: string | null; onChange: (dependentId: string | null) => void };

/** Für wen ist der Termin? Ich oder ein Familienmitglied (nur Spitzname + Altersgruppe). */
export function PatientPicker({ value, onChange }: Props) {
  const styles = useStyles();
  const { t } = useT();
  const toast = useToast();
  const dependents = useDependents();
  const add = useAddDependent();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('child_0_5');

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
              } catch {
                toast.show(t('errors.generic'), 'error');
              }
            }}
          />
        </View>
      ) : (
        <Button
          variant="text"
          icon={UserPlus}
          label={t('booking.addDependent')}
          onPress={() => setAdding(true)}
          style={styles.addButton}
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
