import { LOCALES, useT, type Locale } from '../i18n';

const LABELS: Record<Locale, string> = { de: 'DE', en: 'EN' };
const NAMES: Record<Locale, string> = { de: 'Deutsch', en: 'English' };

export function LanguageSwitch() {
  const { t, locale, setLocale } = useT();
  return (
    <div className="lang" role="group" aria-label={t('app.language')}>
      {LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          className="lang__option"
          aria-pressed={value === locale}
          aria-label={NAMES[value]}
          lang={value}
          onClick={() => setLocale(value)}
        >
          {LABELS[value]}
        </button>
      ))}
    </div>
  );
}
