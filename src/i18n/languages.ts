/**
 * Mehrsprachigkeit (Feature 9) – eine Stelle für alle App-Sprachen.
 * Nutzen: Neue Sprachen kommen ohne Code-Suche dazu (Anleitung: docs/i18n.md).
 *
 * Eine neue App-Sprache:
 *  1. src/i18n/locales/<code>.json anlegen (Schlüssel wie de.json; `npm run check:i18n` prüft)
 *  2. hier einen Eintrag ergänzen und die Datei in src/i18n/index.ts unter `resources` eintragen
 *  3. bei `dir: 'rtl'` (z. B. Arabisch): Layout mit I18nManager prüfen – noch nicht umgesetzt
 *
 * Getrennt davon: PRACTICE_LANGUAGES = Sprachen, die eine Praxis sprechen kann (Filter
 * „spricht Sprache X“). Die müssen keine App-Sprache sein.
 */
export type AppLanguageInfo = {
  code: string;
  /** BCP-47 für Datums- und Zahlenformate */
  locale: string;
  /** Name in der eigenen Sprache – so steht er in der Sprachauswahl */
  nativeName: string;
  dir: 'ltr' | 'rtl';
};

export const APP_LANGUAGES = [
  { code: 'de', locale: 'de-DE', nativeName: 'Deutsch', dir: 'ltr' },
  { code: 'en', locale: 'en-GB', nativeName: 'English', dir: 'ltr' },
] as const satisfies readonly AppLanguageInfo[];

export type AppLanguage = (typeof APP_LANGUAGES)[number]['code'];
export const DEFAULT_LANGUAGE: AppLanguage = 'de';

export function isAppLanguage(code: string | null | undefined): code is AppLanguage {
  return APP_LANGUAGES.some((l) => l.code === code);
}

export function languageInfo(code: string): AppLanguageInfo {
  return APP_LANGUAGES.find((l) => l.code === code) ?? APP_LANGUAGES[0];
}

/** Sprachen, nach denen Praxen gefiltert werden können (ISO 639-1). Deutsch ist Standard. */
export const PRACTICE_LANGUAGES = ['en', 'tr', 'ru', 'ar', 'pl', 'uk', 'fr', 'es'] as const;
export type PracticeLanguage = (typeof PRACTICE_LANGUAGES)[number];
