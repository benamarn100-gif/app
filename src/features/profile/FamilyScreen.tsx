import { ScrollView, View } from 'react-native';

import { Avatar, Card, PressableScale, Skeleton, Stagger, Text } from '@/components';
import { Trash } from '@/components/icons';
import { useDependents, useRemoveDependent } from '@/data/hooks';
import { makeStyles, useTheme } from '@/design/theme';
import { PatientPicker } from '@/features/booking/PatientPicker';
import { useT } from '@/i18n/useT';

/** Familienprofile: nur Spitzname + Altersgruppe (Datensparsamkeit), verschlüsselt gespeichert. */
export function FamilyScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const dependents = useDependents();
  const remove = useRemoveDependent();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text variant="body" color="textSecondary">
        {t('profile.familyHint')}
      </Text>
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
      <PatientPicker value={null} onChange={() => undefined} />
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: { padding: t.layout.screenPadding, gap: t.space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  flex: { flex: 1 },
  remove: {
    width: t.layout.touchTarget,
    height: t.layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
