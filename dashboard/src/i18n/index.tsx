import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { brand } from '@app/config/brand';
import type { AgeGroup, ReasonCategory } from '@app/domain/types';
import { ageGroup as ageGroupDe, reason as reasonDe } from '@app/i18n/locales/de.json';
import { ageGroup as ageGroupEn, reason as reasonEn } from '@app/i18n/locales/en.json';

import { readStorage, writeStorage } from '../lib/storage';
import { de, type Messages } from './de';
import { en } from './en';

export type Locale = 'de' | 'en';
export const LOCALES: Locale[] = ['de', 'en'];

const MESSAGES: Record<Locale, Messages> = { de, en };
/** Anlass und Altersgruppe: dieselben Texte wie in der App. */
const SHARED = {
  de: { reason: reasonDe, ageGroup: ageGroupDe },
  en: { reason: reasonEn, ageGroup: ageGroupEn },
} satisfies Record<
  Locale,
  { reason: Record<ReasonCategory, string>; ageGroup: Record<AgeGroup, string> }
>;

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaves<Messages>;
export type PluralKey = MessageKey extends infer K
  ? K extends `${infer B}_one`
    ? B
    : never
  : never;
type Vars = Record<string, string | number>;

function lookup(messages: unknown, key: string): string | undefined {
  let node = messages;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function interpolate(text: string, vars: Vars = {}): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function createTranslator(locale: Locale) {
  const messages = MESSAGES[locale];
  const rules = new Intl.PluralRules(locale);
  const number = new Intl.NumberFormat(locale);
  const t = (key: MessageKey, vars?: Vars) =>
    interpolate(lookup(messages, key) ?? key, { brand: brand.name, ...vars });
  const tp = (key: PluralKey, count: number, vars?: Vars) => {
    const text =
      lookup(messages, `${key}_${rules.select(count)}`) ?? lookup(messages, `${key}_other`) ?? key;
    return interpolate(text, { brand: brand.name, ...vars, count: number.format(count) });
  };
  return {
    locale,
    t,
    tp,
    reason: (value: ReasonCategory) => SHARED[locale].reason[value],
    ageGroup: (value: AgeGroup) => SHARED[locale].ageGroup[value],
  };
}

export type Translator = ReturnType<typeof createTranslator>;

type I18nValue = Translator & { setLocale: (locale: Locale) => void };
const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = 'mednow.dashboard.locale';

function initialLocale(): Locale {
  const stored = readStorage(STORAGE_KEY);
  if (stored === 'de' || stored === 'en') return stored;
  return typeof navigator !== 'undefined' && navigator.language.startsWith('en') ? 'en' : 'de';
}

export function I18nProvider({
  children,
  locale: fixed,
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => fixed ?? initialLocale());
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStorage(STORAGE_KEY, next);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(() => ({ ...createTranslator(locale), setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useT() außerhalb von <I18nProvider>');
  return value;
}
