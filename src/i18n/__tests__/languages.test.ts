import type { Locale } from 'expo-localization';

import { detectDeviceLanguage, localeFor, resolveLanguage } from '../index';
import { APP_LANGUAGES, isAppLanguage } from '../languages';

// Das echte (gemockte) Modulobjekt – ein `import * as` wäre nur eine Kopie
const localization = jest.requireMock<typeof import('expo-localization')>('expo-localization');
const locales = (codes: string[]) =>
  jest
    .spyOn(localization, 'getLocales')
    .mockReturnValue(codes.map((languageCode) => ({ languageCode }) as Locale));

describe('Mehrsprachigkeit', () => {
  afterEach(() => jest.restoreAllMocks());

  it('nimmt die erste Gerätesprache, die die App kann', () => {
    locales(['tr', 'en']);
    expect(detectDeviceLanguage()).toBe('en');
  });

  it('fällt auf Deutsch zurück', () => {
    locales(['tr']);
    expect(detectDeviceLanguage()).toBe('de');
    locales([]);
    expect(detectDeviceLanguage()).toBe('de');
  });

  it('feste Wahl gewinnt über die Gerätesprache', () => {
    locales(['en']);
    expect(resolveLanguage('de')).toBe('de');
  });

  it('Formate je Sprache aus der zentralen Liste', () => {
    expect(localeFor('en')).toBe('en-GB');
    expect(localeFor('de')).toBe('de-DE');
    expect(localeFor('xx')).toBe('de-DE');
    expect(APP_LANGUAGES.every((l) => isAppLanguage(l.code))).toBe(true);
  });
});
