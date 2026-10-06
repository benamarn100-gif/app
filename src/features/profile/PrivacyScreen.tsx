import { Platform, ScrollView, Share, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import {
  Button,
  Card,
  Divider,
  ListRow,
  SectionHeader,
  Skeleton,
  Text,
  useConfirm,
  useToast,
} from '@/components';
import { Download, MapPin, Trash, TriangleAlert } from '@/components/icons';
import { useConsents, useRevokeConsent } from '@/data/hooks';
import { useRepository } from '@/data/DataProvider';
import { makeStyles, useTheme } from '@/design/theme';
import { formatBerlinDate } from '@/domain/time/berlin';
import type { Consent, ConsentType } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { usePreferences } from '@/state/preferences';

const SHOWN: ConsentType[] = ['health_data', 'push', 'crash_reports'];

/** Datenschutz-Center: Einwilligungen einsehen/widerrufen, Datenexport, Konto löschen. */
export function PrivacyScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const { t, locale } = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const repo = useRepository();
  const client = useQueryClient();
  const consents = useConsents();
  const revoke = useRevokeConsent();
  const prefs = usePreferences();

  const latest = (type: ConsentType): Consent | undefined =>
    (consents.data ?? [])
      .filter((c) => c.type === type)
      .sort((a, b) => Date.parse(b.grantedAt) - Date.parse(a.grantedAt))[0];
  const date = (iso: string) =>
    formatBerlinDate(iso, locale, { day: 'numeric', month: 'long', year: 'numeric' });

  const confirmRevoke = async (type: ConsentType) => {
    const confirmed = await confirm({
      title: t('privacy.revokeConfirmTitle'),
      message: type === 'health_data' ? t('privacy.revokeHealthBody') : undefined,
      confirmLabel: t('privacy.revoke'),
      destructive: true,
    });
    if (!confirmed) return;
    await revoke.mutateAsync(type);
    toast.show(t('privacy.revoked'), 'success');
  };

  const exportData = async () => {
    try {
      const json = JSON.stringify(await repo.exportData(), null, 2);
      if (Platform.OS === 'web') {
        // Browser: kein Teilen-Dialog verlässlich verfügbar → in die Zwischenablage
        await navigator.clipboard.writeText(json);
        toast.show(t('privacy.exportCopied'), 'success');
        return;
      }
      await Share.share({ title: 'mednow-export.json', message: json });
      toast.show(t('privacy.exportReady'), 'success');
    } catch {
      toast.show(
        Platform.OS === 'web' ? t('privacy.exportUnavailable') : t('errors.generic'),
        'error',
      );
    }
  };

  const deleteAll = async () => {
    const confirmed = await confirm({
      title: t('privacy.deleteConfirmTitle'),
      message: t('privacy.deleteConfirmBody'),
      confirmLabel: t('privacy.deleteConfirm'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await repo.deleteAccount();
      client.clear();
      prefs.reset();
      toast.show(t('privacy.deleted'), 'success');
      router.replace('/onboarding');
    } catch {
      toast.show(t('errors.generic'), 'error');
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} testID="privacy-center">
      <Text variant="body" color="textSecondary">
        {t('privacy.intro')}
      </Text>

      <View style={styles.section}>
        <SectionHeader title={t('privacy.consents')} />
        {consents.isLoading ? (
          <Skeleton height={120} />
        ) : (
          SHOWN.map((type) => {
            const c = latest(type);
            const active = c && !c.revokedAt;
            if (type === 'crash_reports') {
              return (
                <Card key={type} padding="none">
                  <ListRow
                    title={t('privacy.crashReports')}
                    subtitle={t('privacy.crashReportsHint')}
                    switchValue={prefs.crashReportsOptIn}
                    onSwitch={(v) => prefs.set({ crashReportsOptIn: v })}
                  />
                </Card>
              );
            }
            return (
              <Card key={type} testID={`consent-${type}`}>
                <Text variant="bodyStrong">{t(`privacy.types.${type}`)}</Text>
                <Text variant="small" color="textSecondary">
                  {!c
                    ? t('privacy.consentNone')
                    : c.revokedAt
                      ? t('privacy.consentRevoked', { date: date(c.revokedAt) })
                      : t('privacy.consentGranted', {
                          date: date(c.grantedAt),
                          version: c.version,
                        })}
                </Text>
                {active ? (
                  <Button
                    variant="text"
                    label={t('privacy.revoke')}
                    onPress={() => confirmRevoke(type)}
                    style={styles.inlineButton}
                  />
                ) : null}
              </Card>
            );
          })
        )}
      </View>

      <Card tone="muted">
        <View style={styles.row}>
          <MapPin size={18} color={theme.colors.primary} strokeWidth={2} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('privacy.location')}</Text>
            <Text variant="small" color="textSecondary">
              {t('privacy.locationHint')}
            </Text>
          </View>
        </View>
      </Card>

      <Card padding="none">
        <ListRow
          icon={Download}
          title={t('privacy.export')}
          subtitle={t('privacy.exportHint')}
          onPress={() => void exportData()}
          testID="export-data"
        />
        <Divider inset={64} />
        <ListRow
          icon={Trash}
          title={t('privacy.deleteAccount')}
          destructive
          onPress={deleteAll}
          testID="delete-account"
        />
      </Card>

      <View style={styles.row}>
        <TriangleAlert size={16} color={theme.colors.textSecondary} strokeWidth={2} />
        <Text variant="caption" color="textSecondary" style={styles.flex}>
          {t('legal.placeholder')}
        </Text>
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: { padding: t.layout.screenPadding, gap: t.space.lg, paddingBottom: t.space.huge },
  section: { gap: t.space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space.sm },
  flex: { flex: 1, gap: 2 },
  inlineButton: { alignSelf: 'flex-start', marginTop: t.space.xs },
}));
