import * as Updates from 'expo-updates';
import { z } from 'zod';

import { resolveCity } from './city';

/**
 * Öffentliche Laufzeitkonfiguration. Nur EXPO_PUBLIC_* landet im App-Bundle –
 * Geheimnisse (Service-Role-Key, Verschlüsselungsschlüssel) gehören ausschließlich
 * in die Edge-Function-Secrets.
 */
const schema = z.object({
  dataMode: z.enum(['memory', 'supabase']),
  supabaseUrl: z.url().optional(),
  supabaseAnonKey: z.string().min(20).optional(),
  mapStyleUrl: z.url(),
  sentryDsn: z.url().optional(),
  demoCity: z.string(),
  /** Testversionen: Diagnose-Seite und Startzeit-Messung (docs/test-builds.md). */
  diagnostics: z.boolean(),
});

export type Env = z.infer<typeof schema>;

const emptyToUndefined = (value: string | undefined) =>
  value === undefined || value.trim() === '' ? undefined : value.trim();

export function parseEnv(source: Record<string, string | undefined>): Env {
  const supabaseUrl = emptyToUndefined(source.EXPO_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = emptyToUndefined(source.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const requested = emptyToUndefined(source.EXPO_PUBLIC_DATA_MODE);
  const hasBackend = Boolean(supabaseUrl && supabaseAnonKey);
  // Ohne Zugangsdaten fällt die App immer auf den Demo-Modus zurück, statt abzustürzen.
  const dataMode = requested !== 'memory' && hasBackend ? 'supabase' : 'memory';

  return schema.parse({
    dataMode,
    supabaseUrl,
    supabaseAnonKey,
    mapStyleUrl:
      emptyToUndefined(source.EXPO_PUBLIC_MAP_STYLE_URL) ??
      'https://tiles.openfreemap.org/styles/positron',
    sentryDsn: emptyToUndefined(source.EXPO_PUBLIC_SENTRY_DSN),
    demoCity: emptyToUndefined(source.EXPO_PUBLIC_DEMO_CITY) ?? 'fulda',
    diagnostics: emptyToUndefined(source.EXPO_PUBLIC_DIAGNOSTICS) === '1',
  });
}

/**
 * Testversionen erkennt die App zusätzlich am Update-Kanal des Builds (eas.json): So bleibt
 * die Diagnose auch nach einem EAS Update an, das ohne die Build-Variablen erstellt wurde.
 */
const TEST_CHANNELS = ['development', 'preview', 'preview-backend'];
const testChannel = TEST_CHANNELS.includes(Updates.channel ?? '') ? '1' : undefined;

// Expo ersetzt process.env.EXPO_PUBLIC_* zur Build-Zeit nur bei direktem Zugriff.
export const env: Env = parseEnv({
  EXPO_PUBLIC_DATA_MODE: process.env.EXPO_PUBLIC_DATA_MODE,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_MAP_STYLE_URL: process.env.EXPO_PUBLIC_MAP_STYLE_URL,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  EXPO_PUBLIC_DEMO_CITY: process.env.EXPO_PUBLIC_DEMO_CITY,
  EXPO_PUBLIC_DIAGNOSTICS: process.env.EXPO_PUBLIC_DIAGNOSTICS || testChannel,
});

export const demoCity = resolveCity(env.demoCity);
