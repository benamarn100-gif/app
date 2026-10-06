import { env } from '@/config/env';
import { usePreferences } from '@/state/preferences';

/**
 * Fehler-Monitoring (docs/decisions.md D-16): nur mit EU-DSN (Sentry EU-Region
 * Frankfurt oder selbst gehostetes GlitchTip), nur nach Opt-in im Datenschutz-Center,
 * ohne personenbezogene Daten. Ohne DSN/Opt-in passiert nichts.
 *
 * Das Sentry-SDK wird bewusst erst eingebunden, wenn eine DSN konfiguriert ist
 * (siehe TODO.md) – bis dahin bleiben Fehler lokal (Konsole im Entwicklungsmodus).
 */
const EU_DSN = /\.(de\.sentry\.io|ingest\.de\.sentry\.io)\b|glitchtip/i;

export function monitoringEnabled(): boolean {
  return Boolean(
    env.sentryDsn && EU_DSN.test(env.sentryDsn) && usePreferences.getState().crashReportsOptIn,
  );
}

/** Entfernt alles, was personenbezogen sein könnte (E-Mail, Telefonnummern, IDs, Koordinaten). */
export function scrub(message: string): string {
  return message
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\+?\d[\d ()/-]{6,}\d/g, '[nummer]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    .replace(/-?\d{1,3}\.\d{3,}/g, '[koordinate]');
}

export function captureError(error: unknown) {
  const message = scrub(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  if (__DEV__) console.warn('[MedNow]', message);
  // Versand an den EU-Endpunkt erfolgt erst nach Einbindung des SDKs (TODO.md).
}
