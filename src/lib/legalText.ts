/**
 * Betreiber-Platzhalter in den Rechtstexten (docs/legal) mit Werten aus der Umgebung füllen,
 * damit Name, Anschrift und Telefon nicht im Repository stehen. Nur exakt diese Schlüssel –
 * alle anderen Platzhalter bleiben sichtbar markiert.
 *
 * Webseite: KONTAKT_* (GitHub-Variablen). App: EXPO_PUBLIC_KONTAKT_* (EAS-Umgebungsvariablen).
 */
export type ContactEnv = Partial<Record<string, string>>;

export function fillContact(md: string, env: ContactEnv): string {
  const values: Record<string, string | undefined> = {
    Name: env.KONTAKT_NAME,
    'E-Mail': env.KONTAKT_EMAIL,
    Telefon: env.KONTAKT_TELEFON,
    Anschrift: env.KONTAKT_ANSCHRIFT,
  };
  return md.replace(/\[PLATZHALTER: ([^\]]+)\]/g, (m, key: string) => values[key.trim()] || m);
}

/** Kontaktwerte der App (beim Build eingesetzt; ohne Werte bleiben die Platzhalter markiert). */
export const appContactEnv: ContactEnv = {
  KONTAKT_NAME: process.env.EXPO_PUBLIC_KONTAKT_NAME,
  KONTAKT_EMAIL: process.env.EXPO_PUBLIC_KONTAKT_EMAIL,
  KONTAKT_TELEFON: process.env.EXPO_PUBLIC_KONTAKT_TELEFON,
  KONTAKT_ANSCHRIFT: process.env.EXPO_PUBLIC_KONTAKT_ANSCHRIFT,
};
