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
  });
}

// Expo ersetzt process.env.EXPO_PUBLIC_* zur Build-Zeit nur bei direktem Zugriff.
export const env: Env = parseEnv({
  EXPO_PUBLIC_DATA_MODE: process.env.EXPO_PUBLIC_DATA_MODE,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_MAP_STYLE_URL: process.env.EXPO_PUBLIC_MAP_STYLE_URL,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  EXPO_PUBLIC_DEMO_CITY: process.env.EXPO_PUBLIC_DEMO_CITY,
});

export const demoCity = resolveCity(env.demoCity);
