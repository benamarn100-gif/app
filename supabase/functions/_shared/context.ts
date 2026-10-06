import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { HttpError } from './http.ts';

/**
 * Laufzeit-Abhängigkeiten der Funktionen – im Test durch Fakes ersetzbar.
 * Der Service-Role-Key existiert nur hier (Edge-Function-Secret), nie im Client.
 */
export type AuthedUser = { id: string; isAnonymous: boolean; email: string | null };

export type Context = {
  getUser(req: Request): Promise<AuthedUser>;
  rpc<T = unknown>(fn: string, params: Record<string, unknown>): Promise<T>;
  query<T = unknown>(table: string, build: (q: any) => any): Promise<T>;
  admin: SupabaseClient | null;
  env(name: string): string | undefined;
};

export function liveContext(): Context {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen');
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'app' },
  });
  const pub = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    admin: pub,
    env: (name) => Deno.env.get(name),
    async getUser(req) {
      const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
      if (!token) throw new HttpError('unauthorized');
      const { data, error } = await pub.auth.getUser(token);
      if (error || !data.user) throw new HttpError('unauthorized');
      return {
        id: data.user.id,
        isAnonymous: data.user.is_anonymous ?? false,
        email: data.user.email ?? null,
      };
    },
    async rpc<T>(fn: string, params: Record<string, unknown>) {
      const { data, error } = await admin.rpc(fn, params);
      if (error) throw error;
      return data as T;
    },
    async query<T>(table: string, build: (q: any) => any) {
      const { data, error } = await build(pub.from(table));
      if (error) throw error;
      return data as T;
    },
  };
}
