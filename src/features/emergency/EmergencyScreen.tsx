import type { ComponentType } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import type { LucideProps } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Text } from '@/components';
import { Globe, HeartHandshake, Phone, Pill, Siren, Stethoscope } from '@/components/icons';
import { brand } from '@/config/brand';
import { makeStyles, useTheme } from '@/design/theme';
import { useT } from '@/i18n/useT';

const tel = (number: string) => `tel:${number.replace(/[^\d+]/g, '')}`;

/**
 * Notfall-Seite (Feature 8): 112, ärztlicher Bereitschaftsdienst 116117, Notdienst-Apotheke,
 * Krisentelefon. Rein statisch – funktioniert offline, ohne Anmeldung und ist nie Teil eines
 * Abos. Keine Diagnose, keine Empfehlung: nur, wer wofür zuständig ist.
 * Nutzen: Im Ernstfall nicht suchen müssen – alle wichtigen Nummern auf einer Seite.
 *
 * Fehlende Daten: MedNow hat keine eigenen Apothekendaten. „Nächste Notapotheke“ führt zur
 * Notdienstsuche der Apothekerkammern (aponet.de) bzw. zum Sprachdialog 22833.
 */
export function EmergencyScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const e = brand.emergency;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      testID="emergency-screen"
    >
      {/* 1. Lebensgefahr – immer zuerst, größte Taste */}
      <Card tone="surface" style={[styles.card, styles.critical]}>
        <Header
          icon={Siren}
          color={theme.colors.statusBooked}
          title={t('emergencyPage.lifeTitle')}
        />
        <Text variant="body">{t('emergencyPage.lifeBody')}</Text>
        <Button
          variant="danger"
          icon={Phone}
          label={t('emergencyPage.call', { number: e.emergency })}
          accessibilityLabel={t('emergency.emergencyA11y', { number: e.emergency })}
          onPress={() => void Linking.openURL(tel(e.emergency))}
          testID="emergency-call-112"
        />
      </Card>

      {/* 2. Ärztlicher Bereitschaftsdienst */}
      <Card style={styles.card}>
        <Header
          icon={Stethoscope}
          color={theme.colors.primary}
          title={t('emergencyPage.onCallTitle')}
        />
        <Text variant="body">{t('emergencyPage.onCallBody')}</Text>
        <Button
          icon={Phone}
          label={t('emergencyPage.call', { number: e.onCallService })}
          accessibilityLabel={t('emergency.onCallA11y', { number: e.onCallService })}
          onPress={() => void Linking.openURL(tel(e.onCallService))}
          testID="emergency-call-116117"
        />
        <Button
          variant="text"
          icon={Globe}
          label={t('emergencyPage.onCallWeb')}
          onPress={() => void Linking.openURL(e.onCallWebUrl)}
        />
      </Card>

      {/* 3. Notdienst-Apotheke */}
      <Card style={styles.card}>
        <Header icon={Pill} color={theme.colors.primary} title={t('emergencyPage.pharmacyTitle')} />
        <Text variant="body">{t('emergencyPage.pharmacyBody')}</Text>
        <Button
          icon={Globe}
          label={t('emergencyPage.pharmacySearch')}
          onPress={() => void Linking.openURL(e.pharmacySearchUrl)}
          testID="emergency-pharmacy-search"
        />
        <Button
          variant="secondary"
          icon={Phone}
          label={t('emergencyPage.pharmacyLandline', { number: e.pharmacyLandline })}
          onPress={() => void Linking.openURL(tel(e.pharmacyLandline))}
        />
        <Button
          variant="secondary"
          icon={Phone}
          label={t('emergencyPage.pharmacyMobile', { number: e.pharmacyMobile })}
          onPress={() => void Linking.openURL(tel(e.pharmacyMobile))}
        />
        <Text variant="caption" color="textSecondary">
          {t('emergencyPage.pharmacySource')}
        </Text>
      </Card>

      {/* 4. Seelische Krise */}
      <Card style={styles.card}>
        <Header
          icon={HeartHandshake}
          color={theme.colors.primary}
          title={t('emergencyPage.crisisTitle')}
        />
        <Text variant="body">{t('emergencyPage.crisisBody')}</Text>
        {e.crisisLines.map((number) => (
          <Button
            key={number}
            variant="secondary"
            icon={Phone}
            label={number}
            accessibilityLabel={t('emergencyPage.crisisA11y', { number })}
            onPress={() => void Linking.openURL(tel(number))}
          />
        ))}
      </Card>

      <Text variant="small" color="textSecondary" style={styles.disclaimer}>
        {t('emergency.disclaimer')}
      </Text>
    </ScrollView>
  );
}

function Header({
  icon: Icon,
  color,
  title,
}: {
  icon: ComponentType<LucideProps>;
  color: string;
  title: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Icon size={24} color={color} strokeWidth={2.25} />
      <Text variant="h3" accessibilityRole="header" style={styles.flex}>
        {title}
      </Text>
    </View>
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
  card: { gap: t.space.sm },
  critical: { borderWidth: 2, borderColor: t.colors.statusBooked },
  header: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  flex: { flex: 1 },
  disclaimer: { textAlign: 'center' },
}));
