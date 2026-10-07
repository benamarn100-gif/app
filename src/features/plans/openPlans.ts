import { router } from 'expo-router';

import type { PaywallReason } from './PlansScreen';

/** Bezahlseite mit Anlass öffnen (bestimmt Überschrift und angebotene Stufe). */
export function openPlans(reason: PaywallReason) {
  router.push({ pathname: '/plans', params: { reason } });
}
