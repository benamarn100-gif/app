// tsx erlaubt das Importieren der TypeScript-Quellen (Marke, Tokens) in der App-Konfiguration.
import 'tsx/cjs';

import type { ConfigContext, ExpoConfig } from 'expo/config';

import { brand } from './src/config/brand';
import { colors } from './src/design/tokens';

/**
 * App-Konfiguration. Markenname zentral in src/config/brand.ts.
 *
 * Umgebungsvariablen (Build-Zeit, keine Geheimnisse – siehe docs/test-builds.md):
 * - EAS_PROJECT_ID / EXPO_OWNER: anderes Expo-Projekt als das Standardprojekt (Updates, Push-Token)
 * - APP_VARIANT=preview: Testversion („MedNow Test“, Diagnose-Seite)
 * - GOOGLE_SERVICES_JSON: Pfad zur Firebase-Datei (EAS-Umgebungsvariable vom Typ „Datei“),
 *   nötig für Push auf Android
 */
/** Expo-Projekt (expo.dev). Kein Geheimnis – die ID steht auch im App-Bundle. */
const DEFAULT_PROJECT_ID = '2fc9f403-cc00-478b-876d-9e2f6b78d1ab';
const projectId = process.env.EAS_PROJECT_ID?.trim() || DEFAULT_PROJECT_ID;
const owner = process.env.EXPO_OWNER?.trim() || undefined;
const isPreview = process.env.APP_VARIANT === 'preview';
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim() || undefined;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...(owner ? { owner } : {}),
  name: isPreview ? `${brand.name} Test` : brand.name,
  slug: brand.slug,
  scheme: brand.scheme,
  version: '0.1.0',
  // Hoch- und Querformat (WCAG 1.3.4, BFSG) – Layouts sind flexibel, Inhalte scrollen.
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: colors.light.background,
  ios: {
    bundleIdentifier: brand.iosBundleIdentifier,
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      // Standardmäßig nur ungefährer Standort (Datensparsamkeit)
      NSLocationDefaultAccuracyReduced: true,
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
  },
  android: {
    package: brand.androidPackage,
    adaptiveIcon: {
      backgroundColor: colors.light.primarySoft,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Kein Hintergrund-Standort, kein präziser Standort nötig.
    blockedPermissions: [
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.RECORD_AUDIO',
    ],
    predictiveBackGestureEnabled: true,
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-web-browser',
    ['expo-secure-store', { faceIDPermission: false, configureAndroidBackup: true }],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: colors.light.background,
        dark: { image: './assets/splash-icon.png', backgroundColor: colors.dark.background },
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'MedNow nutzt deinen ungefähren Standort nur während der Nutzung, um Praxen in deiner Nähe und die Entfernung anzuzeigen. Er wird nicht gespeichert.',
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    [
      'expo-calendar',
      {
        calendarPermission: false,
        remindersPermission: false,
        writeOnlyCalendarPermission:
          'MedNow trägt deinen Termin auf Wunsch in deinen Kalender ein.',
      },
    ],
    [
      'expo-notifications',
      {
        // Android: einfarbiges Symbol in der Statusleiste (sonst weißes Quadrat)
        icon: './assets/notification-icon.png',
        color: colors.light.primary,
        defaultChannel: 'appointments',
      },
    ],
    '@maplibre/maplibre-react-native',
    './plugins/withGradleMemory',
    // Quellkarten-Upload nur, wenn ein Sentry-Projekt (EU-Region) konfiguriert ist.
    // Das SDK selbst startet erst nach Opt-in (src/lib/monitoring.ts).
    ...(process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
      ? [
          [
            '@sentry/react-native',
            {
              url: 'https://de.sentry.io/',
              organization: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT,
            },
          ] as [string, Record<string, string>],
        ]
      : []),
  ],
  experiments: {
    typedRoutes: true,
  },
  runtimeVersion: { policy: 'appVersion' },
  // Beim Start wird nicht auf Updates gewartet (Kaltstart < 2 s); ein neues Update
  // gilt ab dem nächsten Start. EXPO_NO_UPDATES=1 schaltet sie ab (Builds ohne EAS).
  updates:
    process.env.EXPO_NO_UPDATES === '1'
      ? { enabled: false }
      : {
          url: `https://u.expo.dev/${projectId}`,
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
        },
  extra: { eas: { projectId } },
});
