import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import de from './locales/de.json';
import en from './locales/en.json';

// Hermes bringt Intl.PluralRules nicht überall mit – i18next braucht es für _one/_other.
if (typeof Intl === 'undefined' || typeof Intl.PluralRules === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Polyfill nur bei Bedarf
  require('intl-pluralrules');
}

export const SUPPORTED_LANGUAGES = ['de', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguagePreference = 'system' | AppLanguage;

export const resources = {
  de: { translation: de },
  en: { translation: en },
} as const;

/** Deutsch ist Standard; Englisch nur, wenn das Gerät auf Englisch steht. */
export function detectDeviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return code === 'en' ? 'en' : 'de';
}

export function resolveLanguage(preference: LanguagePreference): AppLanguage {
  return preference === 'system' ? detectDeviceLanguage() : preference;
}

/** BCP-47-Locale für Intl-Formatierung. */
export function localeFor(language: string): string {
  return language === 'en' ? 'en-GB' : 'de-DE';
}

if (!i18n.isInitialized) {
  // eslint-disable-next-line import/no-named-as-default-member
  void i18n.use(initReactI18next).init({
    resources,
    lng: detectDeviceLanguage(),
    fallbackLng: 'de',
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
}

export default i18n;

// ---- Typisierte Schlüssel -------------------------------------------------

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

type Strip<K extends string> = K extends `${infer B}_formal_${'one' | 'other'}`
  ? B
  : K extends `${infer B}_${'one' | 'other' | 'formal'}`
    ? B
    : K;

/** Alle gültigen Übersetzungsschlüssel (ohne Plural-/du-Sie-Suffixe). */
export type TranslationKey = Strip<Leaves<typeof de>>;
