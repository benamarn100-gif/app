import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text, TextField } from '@/components';
import { CircleCheck, LocateFixed, MapPin } from '@/components/icons';
import { makeStyles, useTheme } from '@/design/theme';
import { isValidPostalCode } from '@/domain/geo/postalCodes';
import { useT } from '@/i18n/useT';
import { haptics } from '@/lib/haptics';
import { locateDevice, resolvePostalCode } from '@/lib/location';
import { usePreferences } from '@/state/preferences';

type Props = { onDone: () => void };

/**
 * Standort per Freigabe oder Postleitzahl – mit Erklärung, warum wir ihn brauchen.
 * Der Gerätestandort wird nicht gespeichert, nur die Entscheidung, ihn zu nutzen.
 */
export function LocationPicker({ onDone }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const setPrefs = usePreferences((s) => s.set);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const [found, setFound] = useState(false);
  const [plz, setPlz] = useState('');
  const [plzError, setPlzError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  async function handleDevice() {
    setLocating(true);
    const coords = await locateDevice({ ask: true });
    setLocating(false);
    if (coords) {
      setPrefs({ location: { kind: 'device' } });
      setFound(true);
      haptics.success();
      setTimeout(onDone, 600);
    } else {
      setDenied(true);
      haptics.warning();
    }
  }

  async function handlePostal() {
    const code = plz.trim();
    if (!isValidPostalCode(code)) {
      setPlzError(t('onboarding.location.postalCodeInvalid'));
      haptics.warning();
      return;
    }
    setResolving(true);
    const center = await resolvePostalCode(code);
    setResolving(false);
    if (!center) {
      setPlzError(t('onboarding.location.postalCodeNotFound'));
      haptics.warning();
      return;
    }
    setPlzError(null);
    setPrefs({ location: { kind: 'postal', postalCode: code, lat: center.lat, lng: center.lng } });
    haptics.success();
    onDone();
  }

  return (
    <View style={styles.container}>
      <Button
        label={
          found
            ? t('onboarding.location.found')
            : locating
              ? t('onboarding.location.locating')
              : t('onboarding.location.useLocation')
        }
        icon={found ? CircleCheck : LocateFixed}
        loading={locating}
        onPress={() => void handleDevice()}
        testID="use-location"
      />
      {denied ? (
        <Text variant="small" color="textSecondary" accessibilityLiveRegion="polite">
          {t('onboarding.location.denied')}
        </Text>
      ) : null}
      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
        <Text variant="small" color="textSecondary">
          {t('onboarding.location.orPostalCode')}
        </Text>
        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
      </View>
      <TextField
        label={t('onboarding.location.postalCodeLabel')}
        placeholder={t('onboarding.location.postalCodePlaceholder')}
        keyboardType="number-pad"
        maxLength={5}
        value={plz}
        onChangeText={(v) => {
          setPlz(v.replace(/\D/g, ''));
          if (plzError) setPlzError(null);
        }}
        onSubmitEditing={() => void handlePostal()}
        returnKeyType="done"
        icon={MapPin}
        error={plzError}
        textContentType="postalCode"
        autoComplete="postal-code"
        testID="postal-code"
      />
      <Button
        variant="secondary"
        label={t('onboarding.location.usePostalCode')}
        disabled={plz.length !== 5}
        loading={resolving}
        onPress={() => void handlePostal()}
        testID="use-postal-code"
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: { gap: t.space.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  line: { flex: 1, height: 1 },
}));
