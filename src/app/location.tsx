import { ScrollView } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components';
import { makeStyles } from '@/design/theme';
import { LocationPicker } from '@/features/location/LocationPicker';
import { useT } from '@/i18n/useT';

/** Standort ändern (Sheet), z. B. über den Standort-Chip auf der Startseite. */
export default function LocationSheet() {
  const styles = useStyles();
  const { t } = useT();
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text variant="h2">{t('onboarding.location.title')}</Text>
      <Text variant="body" color="textSecondary">
        {t('onboarding.location.body')}
      </Text>
      <LocationPicker onDone={() => router.back()} />
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.xl, gap: t.space.md },
}));
