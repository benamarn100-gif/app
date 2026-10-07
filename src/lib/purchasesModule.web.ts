import type { PurchasesModule } from './purchasesModule';

/** Im Web keine In-App-Käufe – das SDK wird gar nicht erst geladen (Bundle-Budget). */
export function loadPurchases(): PurchasesModule | null {
  return null;
}
