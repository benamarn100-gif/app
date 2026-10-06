import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, PixelRatio, Platform, ScrollView, Share, View } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';

import { Button, Card, Divider, SectionHeader, Text, useToast } from '@/components';
import { env } from '@/config/env';
import { makeStyles } from '@/design/theme';
import { useT, type TFn } from '@/i18n/useT';
import {
  clearMeasurements,
  loadMeasurements,
  median,
  type StartupMeasurement,
} from '@/lib/startup';

type Row = { label: string; value: string };

/** Ziel aus der Vorgabe: Kaltstart < 2 s (docs/performance.md). */
const STARTUP_TARGET_MS = 2000;

/**
 * Testversion: Build-Angaben, gemessene Startzeiten und der Zustand der Bedienungshilfen –
 * für Rückmeldungen von Testerinnen und Testern. Enthält keine personenbezogenen Daten.
 */
export function DiagnosticsScreen() {
  const styles = useStyles();
  const { t } = useT();
  const toast = useToast();
  const [measurements, setMeasurements] = useState<StartupMeasurement[]>([]);
  const a11y = useAccessibilityState();
  const [checking, setChecking] = useState(false);

  const reload = useCallback(() => {
    void loadMeasurements().then(setMeasurements);
  }, []);
  useEffect(reload, [reload]);

  const values = measurements.map((m) => m.jsToInteractiveMs);
  const latest = measurements[0];
  const typical = median(values);

  const build = buildRows(t);
  const startup: Row[] = [
    {
      label: t('diagnostics.startupLatest'),
      value: latest ? ms(latest.jsToInteractiveMs, t) : t('diagnostics.none'),
    },
    {
      label: t('diagnostics.startupMedian', { count: values.length }),
      value: typical === null ? t('diagnostics.none') : ms(typical, t),
    },
    {
      label: t('diagnostics.startupTarget'),
      value: ms(STARTUP_TARGET_MS, t),
    },
  ];
  const accessibility: Row[] = [
    { label: t('diagnostics.screenReader'), value: onOff(a11y.screenReader, t) },
    {
      label: t('diagnostics.fontScale'),
      value: `${Math.round(a11y.fontScale * 100)} %`,
    },
    { label: t('diagnostics.reduceMotion'), value: onOff(a11y.reduceMotion, t) },
    ...(Platform.OS === 'ios'
      ? [{ label: t('diagnostics.boldText'), value: onOff(a11y.boldText, t) }]
      : []),
  ];

  const report = () =>
    [
      t('diagnostics.title'),
      ...[...build, ...startup, ...accessibility].map((r) => `${r.label}: ${r.value}`),
      ...measurements.map((m) => `${m.at} ${m.platform} ${m.screen} ${m.jsToInteractiveMs} ms`),
    ].join('\n');

  const share = async () => {
    try {
      await Share.share({ message: report() });
    } catch {
      toast.show(t('errors.generic'), 'error');
    }
  };

  const checkForUpdate = async () => {
    setChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        toast.show(t('diagnostics.updateNone'), 'success');
        return;
      }
      await Updates.fetchUpdateAsync();
      toast.show(t('diagnostics.updateReady'), 'success');
      await Updates.reloadAsync();
    } catch {
      toast.show(t('diagnostics.updateFailed'), 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="diagnostics-screen"
    >
      <Text variant="body" color="textSecondary">
        {t('diagnostics.intro')}
      </Text>

      <Section title={t('diagnostics.build')} rows={build} />

      <View style={styles.section}>
        <Section title={t('diagnostics.startup')} rows={startup} testID="diagnostics-startup" />
        <Text variant="small" color="textSecondary">
          {t('diagnostics.startupHint')}
        </Text>
        {measurements.length > 0 ? (
          <Button
            variant="text"
            label={t('diagnostics.startupClear')}
            onPress={() => void clearMeasurements().then(reload)}
            style={styles.inlineButton}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Section title={t('diagnostics.accessibility')} rows={accessibility} />
        <Text variant="small" color="textSecondary">
          {t('diagnostics.accessibilityHint')}
        </Text>
      </View>

      <View style={styles.actions}>
        {Platform.OS !== 'web' ? (
          <Button label={t('diagnostics.share')} onPress={share} testID="diagnostics-share" />
        ) : null}
        {Updates.isEnabled ? (
          <Button
            variant="secondary"
            label={t('diagnostics.checkUpdate')}
            onPress={checkForUpdate}
            loading={checking}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

function Section({ title, rows, testID }: { title: string; rows: Row[]; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.section} testID={testID}>
      <SectionHeader title={title} />
      <Card padding="none">
        {rows.map((row, index) => (
          <View key={row.label}>
            {index > 0 ? <Divider /> : null}
            {/* Bezeichnung und Wert als eine Ansage für Screenreader */}
            <View style={styles.row} accessible accessibilityLabel={`${row.label}: ${row.value}`}>
              <Text variant="small" color="textSecondary" style={styles.label}>
                {row.label}
              </Text>
              <Text variant="smallStrong" style={styles.value} selectable>
                {row.value}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

function buildRows(t: TFn): Row[] {
  const nativeVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version;
  const buildNumber = Application.nativeBuildVersion;
  let mapHost = env.mapStyleUrl;
  try {
    mapHost = new URL(env.mapStyleUrl).host;
  } catch {
    // ungültige URL: vollständig anzeigen
  }
  return [
    {
      label: t('diagnostics.version'),
      value: buildNumber ? `${nativeVersion} (${buildNumber})` : (nativeVersion ?? '–'),
    },
    {
      label: t('diagnostics.update'),
      value: !Updates.isEnabled
        ? t('diagnostics.updatesOff')
        : Updates.isEmbeddedLaunch
          ? t('diagnostics.updateEmbedded', { channel: Updates.channel ?? '–' })
          : `${Updates.channel ?? '–'} · ${(Updates.updateId ?? '').slice(0, 8)}`,
    },
    {
      label: t('diagnostics.device'),
      value: [Device.modelName, `${Platform.OS} ${String(Platform.Version)}`]
        .filter(Boolean)
        .join(' · '),
    },
    {
      label: t('diagnostics.dataMode'),
      value: env.dataMode === 'memory' ? t('diagnostics.dataDemo') : t('diagnostics.dataBackend'),
    },
    { label: t('diagnostics.mapServer'), value: mapHost },
    {
      label: t('diagnostics.push'),
      value: Constants.expoConfig?.extra?.eas?.projectId
        ? t('diagnostics.yes')
        : t('diagnostics.no'),
    },
    {
      label: t('diagnostics.monitoring'),
      value: env.sentryDsn ? t('diagnostics.monitoringOptIn') : t('diagnostics.no'),
    },
  ];
}

function ms(value: number, t: TFn) {
  return value >= 1000
    ? t('diagnostics.seconds', { value: (value / 1000).toFixed(2) })
    : t('diagnostics.milliseconds', { value });
}

function onOff(value: boolean, t: TFn) {
  return value ? t('diagnostics.on') : t('diagnostics.off');
}

function useAccessibilityState() {
  const [state, setState] = useState({
    screenReader: false,
    reduceMotion: false,
    boldText: false,
    fontScale: PixelRatio.getFontScale(),
  });
  useEffect(() => {
    let mounted = true;
    const update = (patch: Partial<typeof state>) => {
      if (mounted) setState((s) => ({ ...s, ...patch }));
    };
    void AccessibilityInfo.isScreenReaderEnabled().then((v) => update({ screenReader: v }));
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => update({ reduceMotion: v }));
    if (Platform.OS === 'ios') {
      void AccessibilityInfo.isBoldTextEnabled().then((v) => update({ boldText: v }));
    }
    const subscriptions = [
      AccessibilityInfo.addEventListener('screenReaderChanged', (v) => update({ screenReader: v })),
      AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => update({ reduceMotion: v })),
    ];
    return () => {
      mounted = false;
      subscriptions.forEach((s) => s.remove());
    };
  }, []);
  return state;
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: {
    padding: t.layout.screenPadding,
    gap: t.space.lg,
    paddingBottom: t.space.huge,
    maxWidth: t.layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  section: { gap: t.space.sm },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.sm,
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.md,
    minHeight: 48,
  },
  label: { flexShrink: 1 },
  value: { flexShrink: 1, textAlign: 'right' },
  inlineButton: { alignSelf: 'flex-start' },
  actions: { gap: t.space.sm },
}));
