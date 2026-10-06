import { Platform } from 'react-native';

import { env } from '@/config/env';
import { usePreferences } from '@/state/preferences';

/**
 * Fehler-Monitoring (docs/decisions.md D-16): nur mit EU-DSN (Sentry EU-Region
 * Frankfurt oder selbst gehostetes GlitchTip), nur nach Opt-in im Datenschutz-Center,
 * ohne personenbezogene Daten. Ohne DSN oder ohne Opt-in wird das SDK nie gestartet;
 * beim Widerruf wird es sofort beendet.
 *
 * Bewusst abgeschaltet: Performance-Tracing, Sitzungs-Tracking, Screenshots,
 * View-Hierarchie, Netzwerk-/Navigations-/Konsolen-Breadcrumbs (können IDs oder
 * Suchparameter enthalten), Nutzerkontext und IP-Ableitung.
 */
const EU_DSN = /\.(de\.sentry\.io|ingest\.de\.sentry\.io)\b|glitchtip/i;
const DROPPED_BREADCRUMBS = /^(console|fetch|xhr|http|navigation|touch|ui\.)/;

let started = false;

type SentrySdk = typeof import('@sentry/react-native');
let sdk: SentrySdk | null = null;

/** Das SDK wird erst nach Einwilligung geladen – nicht im Startpfad der App. */
function sentry(): SentrySdk {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sdk ??= require('@sentry/react-native') as SentrySdk;
  return sdk;
}

export function isEuDsn(dsn: string | undefined): dsn is string {
  return !!dsn && EU_DSN.test(dsn);
}

export function monitoringEnabled(): boolean {
  return (
    Platform.OS !== 'web' && isEuDsn(env.sentryDsn) && usePreferences.getState().crashReportsOptIn
  );
}

/** Entfernt alles, was personenbezogen sein könnte (E-Mail, Telefonnummern, IDs, Koordinaten). */
export function scrub(message: string): string {
  // Reihenfolge wichtig: IDs vor Telefonnummern (UUID-Ziffernfolgen ähneln Nummern).
  return message
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    .replace(/\+?\d[\d ()/-]{6,}\d/g, '[nummer]')
    .replace(/-?\d{1,3}\.\d{3,}/g, '[koordinate]');
}

type ScrubbableEvent = {
  message?: string;
  user?: unknown;
  request?: unknown;
  server_name?: string;
  extra?: unknown;
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: { message?: string; data?: unknown }[];
};

/** Letzte Verteidigungslinie vor dem Versand: Kontext entfernen, Texte bereinigen. */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  delete event.user;
  delete event.request;
  delete event.server_name;
  delete event.extra;
  if (event.message) event.message = scrub(event.message);
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = scrub(value.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrub(crumb.message);
    delete crumb.data;
  }
  return event;
}

export function startMonitoring(): void {
  if (started || !monitoringEnabled()) return;
  started = true;
  sentry().init({
    dsn: env.sentryDsn,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableCaptureFailedRequests: false,
    maxBreadcrumbs: 20,
    beforeBreadcrumb: (crumb) => (DROPPED_BREADCRUMBS.test(crumb.category ?? '') ? null : crumb),
    beforeSend: (event) => scrubEvent(event),
  });
}

export function stopMonitoring(): void {
  if (!started) return;
  started = false;
  void sentry().close();
}

/**
 * Verbindet Monitoring mit der Einstellung im Datenschutz-Center: Start nach dem
 * Laden der Einstellungen (falls eingewilligt), Stopp sofort beim Widerruf.
 */
export function bindMonitoring(): () => void {
  const apply = () => (monitoringEnabled() ? startMonitoring() : stopMonitoring());
  const unsubscribeHydration = usePreferences.persist.onFinishHydration(apply);
  const unsubscribe = usePreferences.subscribe((state, previous) => {
    if (state.crashReportsOptIn !== previous.crashReportsOptIn) apply();
  });
  if (usePreferences.persist.hasHydrated()) apply();
  return () => {
    unsubscribe();
    unsubscribeHydration();
  };
}

export function captureError(error: unknown) {
  const message = scrub(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  if (__DEV__) console.warn('[MedNow]', message);
  if (started) sentry().captureException(error);
}
