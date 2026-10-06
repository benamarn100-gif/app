import { Redirect } from 'expo-router';

import { usePreferences } from '@/state/preferences';

export default function Index() {
  const onboarded = usePreferences((s) => s.onboardingCompleted);
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding'} />;
}
