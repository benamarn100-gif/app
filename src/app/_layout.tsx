import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfirmProvider, ToastProvider } from '@/components';
import { DataProvider } from '@/data/DataProvider';
import { ThemeProvider, useTheme } from '@/design/theme';
import { fontFamily } from '@/design/tokens';
import { NotificationBridge } from '@/features/notifications/NotificationBridge';
import i18n, { resolveLanguage } from '@/i18n';
import { useT } from '@/i18n/useT';
import { bindMonitoring } from '@/lib/monitoring';
import { setupOnlineManager } from '@/lib/network';
import { useHasHydrated, usePreferences } from '@/state/preferences';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 250, fade: true });
setupOnlineManager();
bindMonitoring();

export { ErrorBoundary } from '@/features/errors/ErrorBoundary';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [fontFamily.headingSemiBold]: PlusJakartaSans_600SemiBold,
    [fontFamily.headingBold]: PlusJakartaSans_700Bold,
    [fontFamily.body]: Inter_400Regular,
    [fontFamily.bodyMedium]: Inter_500Medium,
  });
  const hydrated = useHasHydrated();
  const themePreference = usePreferences((s) => s.theme);
  const language = usePreferences((s) => s.language);

  useEffect(() => {
    const resolved = resolveLanguage(language);
    void i18n.changeLanguage(resolved);
    // Web: Sprache des Dokuments für Screenreader und Silbentrennung (WCAG 3.1.1)
    if (Platform.OS === 'web') document.documentElement.lang = resolved;
  }, [language]);

  const ready = (fontsLoaded || !!fontError) && hydrated;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider preference={themePreference}>
          <DataProvider>
            <ToastProvider>
              <ConfirmProvider>
                <AppStack />
                <NotificationBridge />
              </ConfirmProvider>
            </ToastProvider>
          </DataProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppStack() {
  const theme = useTheme();
  const { t } = useT();
  useEffect(() => {
    if (Platform.OS !== 'web') void SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: {
            fontFamily: fontFamily.headingSemiBold,
            color: theme.colors.textPrimary,
          },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'default',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="acute" options={{ title: t('acute.title') }} />
        <Stack.Screen
          name="practice/[id]"
          options={{ title: '', headerStyle: { backgroundColor: theme.colors.blobTeal } }}
        />
        <Stack.Screen
          name="booking/[slotId]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.92],
            sheetGrabberVisible: true,
            sheetCornerRadius: theme.radius.lg,
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.surface },
          }}
        />
        <Stack.Screen
          name="booking/success"
          options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen
          name="filters"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: theme.radius.lg,
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.surface },
          }}
        />
        <Stack.Screen
          name="waitlist/[practiceId]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: theme.radius.lg,
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.surface },
          }}
        />
        <Stack.Screen
          name="location"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.7, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: theme.radius.lg,
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.surface },
          }}
        />
        <Stack.Screen
          name="offer/[offerId]"
          options={{ presentation: 'modal', title: t('offer.pending') }}
        />
        <Stack.Screen
          name="appointments/[id]/reschedule"
          options={{ title: t('appointments.rescheduleTitle') }}
        />
        <Stack.Screen name="settings/privacy" options={{ title: t('privacy.title') }} />
        <Stack.Screen name="settings/family" options={{ title: t('profile.family') }} />
        <Stack.Screen name="settings/legal/[page]" options={{ title: '' }} />
        <Stack.Screen name="settings/diagnostics" options={{ title: t('diagnostics.title') }} />
        <Stack.Screen name="dev/showcase" options={{ title: t('showcase.title') }} />
      </Stack>
    </>
  );
}
