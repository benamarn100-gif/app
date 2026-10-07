import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { brand } from '@/config/brand';
import { env } from '@/config/env';
import { MemoryRepository } from '@/data/memory/MemoryRepository';
import type { MedNowRepository, PlanInfo } from '@/data/repository';
import { ENTITLEMENT_IDS, PRODUCTS, type PlanId, type Product } from '@/domain/plans';
import type { TFn } from '@/i18n/useT';

import { CHANNEL_REMINDERS } from './notifications';
import { loadPurchases, type PurchasesModule } from './purchasesModule';

/**
 * In-App-Käufe (Phase 4) hinter einer schmalen Schnittstelle:
 *  - demo: Demo-Modus – schaltet lokal frei, es wird nichts berechnet
 *  - store: RevenueCat über App Store / Google Play (nur nativ, mit öffentlichem SDK-Schlüssel)
 *  - unavailable: Web oder fehlende Schlüssel – die Bezahlseite sagt das ehrlich
 *
 * Datenschutz: RevenueCat bekommt nur die pseudonyme Supabase-Nutzer-ID – keine E-Mail,
 * keine Attribute, keine Werbe-/Attributions-Anbindung. Die Stufe für Grenzen setzt der
 * Server (Webhook → app.entitlements), die App liest sie über get_my_plan.
 */
export type Offer = Product & {
  /** Gesamtpreis, lokalisiert („29,99 €“) */
  price: string;
  /** kleiner Monatswert nur bei Jahresabos („2,50 €“) */
  perMonth: string | null;
};

export type PurchaseResult = 'purchased' | 'cancelled';
export type LocalPlan = PlanInfo & { trial: boolean };

export interface Billing {
  readonly kind: 'demo' | 'store' | 'unavailable';
  loadOffers(locale: string): Promise<Offer[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  restore(): Promise<void>;
  /** Abo im Store verwalten bzw. kündigen */
  manage(): Promise<void>;
  /** Stufe laut Store (sofort nach dem Kauf, bevor der Server-Webhook ankommt) */
  localPlan(): Promise<LocalPlan | null>;
  identify(userId: string): Promise<void>;
}

const euro = (cents: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);

function fallbackOffers(locale: string): Offer[] {
  return PRODUCTS.map((p) => ({
    ...p,
    price: euro(p.fallbackPriceCents, locale),
    perMonth: p.kind === 'yearly' ? euro(Math.round(p.fallbackPriceCents / 12), locale) : null,
  }));
}

// ---- Demo ---------------------------------------------------------------------

class DemoBilling implements Billing {
  readonly kind = 'demo' as const;
  constructor(private readonly repo: MemoryRepository) {}
  loadOffers(locale: string) {
    return Promise.resolve(fallbackOffers(locale));
  }
  async purchase(productId: string): Promise<PurchaseResult> {
    await this.repo.demoPurchase(productId);
    return 'purchased';
  }
  restore() {
    return Promise.resolve();
  }
  async manage() {
    await this.repo.demoEndPlan();
  }
  localPlan() {
    return Promise.resolve(null);
  }
  identify() {
    return Promise.resolve();
  }
}

// ---- Nicht verfügbar ------------------------------------------------------------

class UnavailableBilling implements Billing {
  readonly kind = 'unavailable' as const;
  loadOffers(locale: string) {
    return Promise.resolve(fallbackOffers(locale));
  }
  purchase(): Promise<PurchaseResult> {
    return Promise.reject(new Error('billing_unavailable'));
  }
  restore() {
    return Promise.resolve();
  }
  manage() {
    return Promise.resolve();
  }
  localPlan() {
    return Promise.resolve(null);
  }
  identify() {
    return Promise.resolve();
  }
}

// ---- RevenueCat ------------------------------------------------------------------

type StoreProduct = import('react-native-purchases').PurchasesStoreProduct;

class StoreBilling implements Billing {
  readonly kind = 'store' as const;
  private configured = false;
  private products = new Map<string, StoreProduct>();

  constructor(
    private readonly purchases: PurchasesModule,
    private readonly apiKey: string,
  ) {}

  async identify(userId: string) {
    if (!this.configured) {
      // Nur die pseudonyme Nutzer-ID – keine weiteren Attribute
      this.purchases.configure({ apiKey: this.apiKey, appUserID: userId });
      this.configured = true;
      return;
    }
    await this.purchases.logIn(userId);
  }

  async loadOffers(locale: string): Promise<Offer[]> {
    const ids = PRODUCTS.map((p) => p.id);
    const [subs, once] = await Promise.all([
      this.purchases.getProducts(ids).catch(() => []),
      this.purchases
        .getProducts(ids, this.purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION)
        .catch(() => []),
    ]);
    for (const p of [...subs, ...once]) this.products.set(p.identifier, p);
    return PRODUCTS.map((p) => {
      const store = this.products.get(p.id);
      return {
        ...p,
        price: store?.priceString ?? euro(p.fallbackPriceCents, locale),
        perMonth:
          p.kind === 'yearly'
            ? (store?.pricePerMonthString ?? euro(Math.round(p.fallbackPriceCents / 12), locale))
            : null,
      };
    });
  }

  async purchase(productId: string): Promise<PurchaseResult> {
    const product = this.products.get(productId);
    if (!product) throw new Error('product_unavailable');
    try {
      await this.purchases.purchaseStoreProduct(product);
      return 'purchased';
    } catch (e) {
      if ((e as { userCancelled?: boolean | null }).userCancelled) return 'cancelled';
      throw e;
    }
  }

  async restore() {
    await this.purchases.restorePurchases();
  }

  async manage() {
    if (Platform.OS === 'ios') {
      await this.purchases.showManageSubscriptions();
      return;
    }
    const info = await this.purchases.getCustomerInfo();
    await Linking.openURL(
      info.managementURL ??
        `https://play.google.com/store/account/subscriptions?package=${brand.androidPackage}`,
    );
  }

  async localPlan(): Promise<LocalPlan | null> {
    if (!this.configured) return null;
    const info = await this.purchases.getCustomerInfo();
    const active = info.entitlements.active;
    const plan: PlanId | null = active[ENTITLEMENT_IDS.family]
      ? 'family'
      : active[ENTITLEMENT_IDS.plus]
        ? 'plus'
        : null;
    if (!plan) return null;
    const ent = active[ENTITLEMENT_IDS[plan]]!;
    return { plan, expiresAt: ent.expirationDate, trial: ent.periodType === 'TRIAL' };
  }
}

// ---- Auswahl ----------------------------------------------------------------------

let instance: { repo: MedNowRepository; billing: Billing } | null = null;

export function getBilling(repo: MedNowRepository): Billing {
  if (instance?.repo === repo) return instance.billing;
  instance = { repo, billing: createBilling(repo) };
  return instance.billing;
}

function createBilling(repo: MedNowRepository): Billing {
  if (repo instanceof MemoryRepository) return new DemoBilling(repo);
  const key = Platform.OS === 'ios' ? env.revenueCatIosKey : env.revenueCatAndroidKey;
  if (Platform.OS === 'web' || !key) return new UnavailableBilling();
  // Natives Modul fehlt in älteren Builds/Expo Go → ehrlich „nicht verfügbar“
  const purchases = loadPurchases();
  return purchases ? new StoreBilling(purchases, key) : new UnavailableBilling();
}

/**
 * Testphase: 3 Tage vor Ende erinnern (mehr, als die Stores verlangen). Neutraler Text,
 * nur wenn Mitteilungen erlaubt sind.
 */
export async function scheduleTrialReminder(expiresAt: string, t: TFn): Promise<void> {
  if (Platform.OS === 'web') return;
  const at = Date.parse(expiresAt) - 3 * 86_400_000;
  if (!Number.isFinite(at) || at <= Date.now() + 60_000) return;
  await Notifications.scheduleNotificationAsync({
    identifier: 'trial-ending',
    content: { title: t('plans.trialEndingTitle'), body: t('plans.trialEndingBody') },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(at),
      channelId: CHANNEL_REMINDERS,
    },
  }).catch(() => undefined);
}
