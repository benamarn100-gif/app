import { Redirect } from 'expo-router';

import { env } from '@/config/env';
import { DiagnosticsScreen } from '@/features/profile/DiagnosticsScreen';

/** Nur in Testversionen (EXPO_PUBLIC_DIAGNOSTICS=1) und in der Entwicklung erreichbar. */
export default function Diagnostics() {
  if (!env.diagnostics && !__DEV__) return <Redirect href="/" />;
  return <DiagnosticsScreen />;
}
