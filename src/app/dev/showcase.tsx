import { Redirect } from 'expo-router';

import { ShowcaseScreen } from '@/features/showcase/ShowcaseScreen';

/** Nur im Entwicklungsmodus erreichbar. */
export default function Showcase() {
  if (!__DEV__) return <Redirect href="/" />;
  return <ShowcaseScreen />;
}
