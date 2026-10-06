/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import { brand } from '../src/config/brand';
import { themeCss } from './src/theme/css';

const THEME_ID = 'virtual:mednow-theme.css';
const THEME_RESOLVED = '/__mednow-theme.css';

/** Design-Tokens → CSS-Variablen (als echte Stylesheet-Datei, CSP-freundlich). */
function themePlugin(): Plugin {
  return {
    name: 'mednow-theme',
    resolveId: (id) => (id === THEME_ID ? THEME_RESOLVED : null),
    load: (id) => (id === THEME_RESOLVED ? themeCss() : null),
  };
}

/** Titel aus der Markenkonfiguration; strenge Content-Security-Policy im Build. */
function htmlPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'mednow-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        let out = html.replace(/<title>[^<]*<\/title>/, `<title>${brand.name} Praxis</title>`);
        if (!ctx.server) {
          const api = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).origin : '';
          const ws = api.replace(/^http/, 'ws');
          const policy = [
            "default-src 'self'",
            `connect-src 'self'${api ? ` ${api} ${ws}` : ''}`,
            "img-src 'self' data:",
            "style-src 'self'",
            "font-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; ');
          out = out.replace(
            '<!--mednow:csp-->',
            `<meta http-equiv="Content-Security-Policy" content="${policy}" />`,
          );
        }
        return out;
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
  return {
    plugins: [react(), themePlugin(), htmlPlugin(env)],
    resolve: {
      alias: { '@app': fileURLToPath(new URL('../src', import.meta.url)) },
      // Gemeinsamer Domain-Code (../src/domain) nutzt die Pakete des Dashboards.
      dedupe: ['date-fns', '@date-fns/tz'],
    },
    server: { port: 5173, fs: { allow: ['.', '../src'] } },
    // Keine data:-URIs (CSP font-src 'self'): kleine Schrift-Teilmengen bleiben eigene Dateien.
    build: { target: 'es2022', sourcemap: false, assetsInlineLimit: 0 },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
    },
  };
});
