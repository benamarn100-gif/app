import { resolveCity, type CityConfig } from '@app/config/city';

export type DashboardConfig = {
  dataMode: 'demo' | 'supabase';
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  demoCity: CityConfig;
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Nur https (lokal auch http://localhost bzw. 127.0.0.1 für `supabase start`). */
function parseUrl(value: string): string | null {
  if (!value) return null;
  const url = new URL(value);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('VITE_SUPABASE_URL muss https verwenden');
  }
  return url.origin;
}

/** Schützt davor, versehentlich einen geheimen Schlüssel in den Browser zu geben. */
export function assertPublicKey(key: string): void {
  if (key.startsWith('sb_secret_')) throw new Error('Geheimer Supabase-Schlüssel im Dashboard');
  const [, payload] = key.split('.');
  if (!payload) return;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: string;
    };
    if (claims.role === 'service_role') {
      throw new Error('Service-Role-Key darf nie im Dashboard verwendet werden');
    }
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
}

export function readConfig(raw: Record<string, unknown> = import.meta.env): DashboardConfig {
  const mode = text(raw.VITE_DATA_MODE);
  if (mode && mode !== 'demo' && mode !== 'supabase') {
    throw new Error('VITE_DATA_MODE muss "demo" oder "supabase" sein');
  }
  const url = parseUrl(text(raw.VITE_SUPABASE_URL));
  const key = text(raw.VITE_SUPABASE_ANON_KEY) || null;
  if (key) assertPublicKey(key);
  const supabase = mode !== 'demo' && !!url && !!key;
  return {
    dataMode: supabase ? 'supabase' : 'demo',
    supabaseUrl: url,
    supabaseAnonKey: key,
    demoCity: resolveCity(text(raw.VITE_DEMO_CITY) || undefined),
  };
}
