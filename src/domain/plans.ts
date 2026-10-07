/**
 * Abo-Stufen (Phase 4, Konzept „MedNow – Abo-Konzept“ vom 06.10.2026).
 *
 * Grundsätze:
 *  - Kern bleibt kostenlos: Suche, alle Filter, Karte, Buchen (auch für Angehörige),
 *    Akut-Modus/„Heute“, Erinnerungen, manueller Kalendereintrag, Notfall-Seite, Datenschutz.
 *  - Fairness-Regel: Bezahlen verschafft NIE Vorrang. Termin-Alarme bleiben FIFO nach
 *    Eintragungszeit mit 10 Minuten Reservierung für alle – Plus erhöht nur die Anzahl.
 *  - Keine Werbung in keiner Stufe (deshalb auch kein „werbefrei“-Versprechen).
 *
 * Dieselben Grenzen prüft die Datenbank (Migration 1300) – die App zeigt sie nur an.
 */
export type PlanId = 'free' | 'plus' | 'family';

export type Feature =
  'calendarSync' | 'favorites' | 'checkupReminders' | 'familyCheckupReminders' | 'longAlarms';

export type PlanLimits = {
  /** gleichzeitig aktive Termin-Alarme */
  activeAlarms: number;
  /** gespeicherte Personen inkl. „Ich“ */
  profiles: number;
  /** mögliche Alarm-Laufzeiten in Tagen */
  alarmDays: readonly number[];
};

const BASE_DAYS = [1, 3, 7, 14] as const;
const LONG_DAYS = [1, 3, 7, 14, 30, 60] as const;

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  // „Ich + 1“: Buchen für das eigene Kind muss kostenlos bleiben (Konzept: immer kostenlos)
  free: { activeAlarms: 1, profiles: 2, alarmDays: BASE_DAYS },
  plus: { activeAlarms: 10, profiles: 2, alarmDays: LONG_DAYS },
  family: { activeAlarms: 10, profiles: 5, alarmDays: LONG_DAYS },
};

const FEATURES: Record<PlanId, readonly Feature[]> = {
  free: [],
  plus: ['calendarSync', 'favorites', 'checkupReminders', 'longAlarms'],
  family: ['calendarSync', 'favorites', 'checkupReminders', 'familyCheckupReminders', 'longAlarms'],
};

export function can(plan: PlanId, feature: Feature): boolean {
  return FEATURES[plan].includes(feature);
}

/** Kleinste Stufe, die eine Funktion freischaltet (für die Paywall). */
export function planFor(feature: Feature): Exclude<PlanId, 'free'> {
  return can('plus', feature) ? 'plus' : 'family';
}

export const PLAN_RANK: Record<PlanId, number> = { free: 0, plus: 1, family: 2 };

export function higherPlan(a: PlanId, b: PlanId): PlanId {
  return PLAN_RANK[a] >= PLAN_RANK[b] ? a : b;
}

/**
 * Produkte (IDs in App Store Connect / Google Play / RevenueCat identisch anlegen).
 * Preise hier nur als Rückfall für die Anzeige im Demo-Modus – im Store gilt der dort
 * hinterlegte, lokalisierte Preis.
 */
export type ProductKind = 'pass' | 'yearly';
export type ProductId = 'mednow_plus_pass_30d' | 'mednow_plus_yearly' | 'mednow_family_yearly';
export type Product = {
  id: ProductId;
  plan: Exclude<PlanId, 'free'>;
  kind: ProductKind;
  /** Rückfallpreis in Euro-Cent (Anzeige im Demo-Modus) */
  fallbackPriceCents: number;
  /** kostenlose Testphase in Tagen (nur Jahresabos) */
  trialDays: number;
  /** Laufzeit in Tagen (Demo-Modus, Pass) */
  durationDays: number;
};

export const PRODUCTS: readonly Product[] = [
  {
    id: 'mednow_plus_pass_30d',
    plan: 'plus',
    kind: 'pass',
    fallbackPriceCents: 499,
    trialDays: 0,
    durationDays: 30,
  },
  {
    id: 'mednow_plus_yearly',
    plan: 'plus',
    kind: 'yearly',
    fallbackPriceCents: 2999,
    trialDays: 14,
    durationDays: 365,
  },
  {
    id: 'mednow_family_yearly',
    plan: 'family',
    kind: 'yearly',
    fallbackPriceCents: 4499,
    trialDays: 14,
    durationDays: 365,
  },
];

/** Entitlement-IDs in RevenueCat (= Stufen) */
export const ENTITLEMENT_IDS: Record<Exclude<PlanId, 'free'>, string> = {
  plus: 'plus',
  family: 'family',
};
