import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { usePreferences } from '@/state/preferences';

import { localeFor, type TranslationKey } from './index';

export type TOptions = Record<string, unknown> & { count?: number };
export type TFn = (key: TranslationKey, options?: TOptions) => string;

/**
 * Übersetzungs-Hook mit du/Sie-Umschaltung: Ist „Sie“ gewählt, nutzt i18next
 * automatisch `<key>_formal`, falls vorhanden (sonst die neutrale Fassung).
 */
export function useT() {
  const { t: rawT, i18n } = useTranslation();
  const formal = usePreferences((s) => s.formalAddress);
  const language = i18n.language;

  const t = useCallback<TFn>(
    (key, options) =>
      rawT(
        key as never,
        {
          ...(formal && language === 'de' ? { context: 'formal' } : {}),
          ...options,
        } as never,
      ) as unknown as string,
    [rawT, formal, language],
  );

  return { t, language, locale: localeFor(language) };
}
