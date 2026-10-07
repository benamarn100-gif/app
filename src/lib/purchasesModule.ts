import { NativeModules } from 'react-native';

export type PurchasesModule = typeof import('react-native-purchases').default;

/**
 * Natives Kauf-SDK; null, wenn das native Modul fehlt (ältere Builds, Expo Go). Den
 * Browser-Modus des SDK nutzen wir nativ nicht – er ist per metro.config.js ausgeblendet.
 */
export function loadPurchases(): PurchasesModule | null {
  if (!NativeModules.RNPurchases) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('react-native-purchases') as { default: PurchasesModule }).default;
  } catch {
    return null;
  }
}
