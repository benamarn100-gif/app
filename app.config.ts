// tsx erlaubt das Importieren der TypeScript-Quellen (Marke, Tokens) in der App-Konfiguration.
import 'tsx/cjs';

import type { ConfigContext, ExpoConfig } from 'expo/config';

import { brand } from './src/config/brand';
import { colors } from './src/design/tokens';

/**
 * App-Konfiguration. Markenname zentral in src/config/brand.ts.
 * EAS: EAS_PROJECT_ID setzen (eas init), dann `eas build` / `eas update`.
 */
const projectId = process.env.EAS_PROJECT_ID;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: brand.name,
  slug: brand.slug,
  scheme: brand.scheme,
  version: '0.1.0',
  orientation: 'portrait',
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
    ['expo-notifications', { color: colors.light.primary, defaultChannel: 'appointments' }],
    '@maplibre/maplibre-react-native',
  ],
  experiments: {
    typedRoutes: true,
  },
  runtimeVersion: { policy: 'appVersion' },
  ...(projectId
    ? {
        updates: { url: `https://u.expo.dev/${projectId}` },
        extra: { eas: { projectId } },
      }
    : {}),
});
