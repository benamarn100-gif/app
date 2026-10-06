import { describe, expect, it } from 'vitest';

import { readConfig } from '../config';

const jwt = (payload: object) =>
  `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.signature`;

describe('Konfiguration', () => {
  it('ohne Zugangsdaten → Demo', () => {
    expect(readConfig({}).dataMode).toBe('demo');
  });

  it('mit URL und öffentlichem Schlüssel → Supabase, außer Demo ist erzwungen', () => {
    const env = {
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon' }),
    };
    expect(readConfig(env).dataMode).toBe('supabase');
    expect(readConfig({ ...env, VITE_DATA_MODE: 'demo' }).dataMode).toBe('demo');
    expect(readConfig({ ...env, VITE_SUPABASE_ANON_KEY: 'sb_publishable_123' }).dataMode).toBe(
      'supabase',
    );
  });

  it('weist geheime Schlüssel zurück', () => {
    const base = { VITE_SUPABASE_URL: 'https://abc.supabase.co' };
    expect(() =>
      readConfig({ ...base, VITE_SUPABASE_ANON_KEY: jwt({ role: 'service_role' }) }),
    ).toThrow();
    expect(() => readConfig({ ...base, VITE_SUPABASE_ANON_KEY: 'sb_secret_abc' })).toThrow();
  });

  it('verlangt https (außer lokal) und gültige Modi', () => {
    const key = jwt({ role: 'anon' });
    expect(() =>
      readConfig({ VITE_SUPABASE_URL: 'http://abc.supabase.co', VITE_SUPABASE_ANON_KEY: key }),
    ).toThrow();
    expect(
      readConfig({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: key })
        .dataMode,
    ).toBe('supabase');
    expect(() => readConfig({ VITE_DATA_MODE: 'memory' })).toThrow();
  });
});
