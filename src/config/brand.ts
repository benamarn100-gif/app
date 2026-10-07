/**
 * Zentrale Markenkonfiguration. „MedNow“ ist ein Arbeitstitel –
 * vor dem Launch Markenrecht prüfen (DPMA/EUIPO-Recherche), dann nur hier ändern.
 *
 * Diese Datei darf keine React-Native-Importe enthalten: Sie wird auch von
 * app.config.ts (Node) und dem Praxis-Dashboard (Web) gelesen.
 * Serverseitig steht der Name zusätzlich in supabase/templates/*.html (E-Mail-Codes)
 * und in den Push-Titeln (supabase/functions/_shared/push.ts).
 */
export const brand = {
  name: 'MedNow',
  slug: 'mednow',
  scheme: 'mednow',
  iosBundleIdentifier: 'de.mednow.app',
  androidPackage: 'de.mednow.app',
  /** Wird im Impressum-Platzhalter angezeigt – vor Launch ersetzen. */
  publisher: 'MedNow (Arbeitstitel) – Angaben vor Launch ergänzen',
  emergency: {
    /** Ärztlicher Bereitschaftsdienst */
    onCallService: '116117',
    /** Notruf */
    emergency: '112',
    /**
     * Notfall-Seite (Feature 8). Stand 10/2026, geprüft gegen aponet.de und Telefonseelsorge.
     * Apotheken-Notdienst: Sprachdialog fragt die PLZ ab und nennt die nächsten Notapotheken.
     */
    pharmacyLandline: '0800 00 22833',
    pharmacyMobile: '22833',
    pharmacySearchUrl: 'https://www.aponet.de/apotheke/notdienstsuche',
    onCallWebUrl: 'https://www.116117.de',
    /** TelefonSeelsorge: kostenlos, anonym, rund um die Uhr */
    crisisLines: ['0800 111 0 111', '0800 111 0 222', '116 123'],
  },
} as const;

export type Brand = typeof brand;
