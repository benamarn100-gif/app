# Angaben für die Store-Formulare

> Stand: 07.10.2026. Abgeleitet aus dem Code (Berechtigungen in `app.config.ts`, Datenflüsse in
> `src/data/supabase`, `src/lib`, `supabase/migrations`). Muss zur Datenschutzerklärung
> (`docs/legal/datenschutz.md`) passen. Formularnamen der Stores ändern sich gelegentlich – beim Ausfüllen
> die Bedeutung, nicht den genauen Wortlaut abgleichen.

## Vor dem Ausfüllen: Konto-Art

- **Apple:** Apps aus dem Gesundheitsbereich müssen von einer **Organisation** eingereicht werden, nicht von
  einer Privatperson (App Review Guideline 5.1.1(ix)). Dafür braucht es ein Unternehmen (z. B.
  Einzelunternehmen mit Gewerbeanmeldung, UG oder GmbH) und eine **D-U-N-S-Nummer** (kostenlos über Apple
  beantragbar).
- **Google:** Ein **Organisationskonto** (ebenfalls mit D-U-N-S-Nummer) ist empfohlen. Neue private Konten
  müssen vor der Veröffentlichung einen geschlossenen Test mit mindestens 12 Testerinnen und Testern über
  14 Tage durchführen.

## Google Play – Datensicherheit

Allgemein:

| Frage                                             | Antwort                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Erhebt oder teilt die App Nutzerdaten?            | Ja (Erheben). Teilen: **Nein**                                                                                                                               |
| Begründung „nicht geteilt“                        | Übermittlung an die gebuchte Praxis erfolgt auf ausdrückliche Aktion der Person (Buchung); Dienstleister (Supabase, Expo, RevenueCat) verarbeiten im Auftrag |
| Daten bei der Übertragung verschlüsselt?          | Ja (HTTPS/TLS)                                                                                                                                               |
| Können Nutzer die Löschung ihrer Daten anfordern? | Ja – in der App (Profil → Datenschutz → Konto löschen) und per E-Mail                                                                                        |
| Link zum Löschen (Webseite)                       | `https://[PLATZHALTER: Domain]/datenschutz/` (Abschnitt Ihre Rechte)                                                                                         |

Datentypen (alle: **erhoben, nicht geteilt**):

| Datentyp                 | Wofür                                      | Erforderlich?                       | Hinweis                                                                                                                                 |
| ------------------------ | ------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Ungefährer Standort      | App-Funktionen (Suche in der Nähe)         | optional                            | Nur „beim Verwenden“, vor dem Senden auf ca. 110 m gerundet; beim Termin-Alarm „jede Praxis“ gespeichert. Genauer Standort ist gesperrt |
| Name                     | App-Funktionen (Buchung)                   | optional (nur für Buchungen)        | Verschlüsselt gespeichert                                                                                                               |
| E-Mail-Adresse           | Kontoverwaltung, App-Funktionen            | optional (nur für Buchungen/Alarme) | Bestätigung per Code                                                                                                                    |
| Telefonnummer            | App-Funktionen (Praxis erreicht dich)      | optional (nur für Buchungen)        | Verschlüsselt gespeichert                                                                                                               |
| Gesundheitsinformationen | App-Funktionen                             | optional                            | Gebuchte Fachrichtung/Anlass-Kategorie, Termin-Alarme – nur mit Einwilligung                                                            |
| Kaufverlauf              | App-Funktionen (Plus/Familie freischalten) | optional                            | Nur Stufe, Produkt und Ablaufdatum                                                                                                      |
| Geräte- oder andere IDs  | App-Funktionen (Mitteilungen)              | optional                            | Push-Token, nur wenn Mitteilungen erlaubt                                                                                               |
| Absturzprotokolle        | Analysen der App-Stabilität                | optional                            | **Nur angeben, wenn Absturzberichte (Opt-in) eingerichtet sind**                                                                        |

Nicht erhoben: genauer Standort, Fotos, Kontakte, Nachrichten, Audio, App-Aktivität/Nutzungsanalyse,
Werbe-IDs. Kalendereinträge und Vorsorge-Erinnerungen bleiben auf dem Gerät (keine Erhebung).

## Google Play – weitere App-Inhalte

| Formular                     | Antwort                                                                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gesundheits-Apps             | Gesundheitsdienste/-verwaltung: Terminvermittlung bei Arztpraxen. Kein Medizinprodukt, keine Diagnose                                                                                                            |
| Zielgruppe                   | 16–17 und ab 18 Jahren (nicht für Kinder; Konten ab 16 laut Nutzungsbedingungen)                                                                                                                                 |
| Einstufung (IARC-Fragebogen) | Kategorie „Dienstprogramm/Sonstiges“; Gewalt, Sexualität, Sprache, Drogen, Glücksspiel: nein; Nutzer können nicht miteinander kommunizieren; Standort wird nicht mit anderen Nutzern geteilt; digitale Käufe: ja |
| Werbung                      | Nein, die App enthält keine Werbung                                                                                                                                                                              |
| Behörden-App                 | Nein                                                                                                                                                                                                             |
| Finanzfunktionen             | Keine                                                                                                                                                                                                            |
| Zugriff für Prüfung          | Siehe „Zugang für die Prüfung“ unten                                                                                                                                                                             |

Berechtigungen (Begründung):

| Berechtigung                | Wofür                                                                |
| --------------------------- | -------------------------------------------------------------------- |
| Ungefährer Standort         | Praxen in der Nähe, nur während der Nutzung                          |
| Mitteilungen                | Termin-Alarm, Terminerinnerungen, Vorsorge-Erinnerungen              |
| Kalender                    | Termin in den Kalender eintragen bzw. Kalender-Sync (nur auf Wunsch) |
| Abrechnung über Google Play | MedNow Plus und Familie                                              |

Nach dem ersten Hochladen in der Play Console unter „App-Bundle-Explorer“ die tatsächliche Liste prüfen.

## Apple – App-Datenschutz

**Tracking: Nein.** Keine Daten werden zum Tracking verwendet.

| Datentyp (Apple)                   | Mit der Identität verknüpft | Zweck              | Hinweis                                              |
| ---------------------------------- | --------------------------- | ------------------ | ---------------------------------------------------- |
| Kontaktinformationen: Name         | Ja                          | App-Funktionalität | nur bei Buchung                                      |
| Kontaktinformationen: E-Mail       | Ja                          | App-Funktionalität | Bestätigung per Code                                 |
| Kontaktinformationen: Telefon      | Ja                          | App-Funktionalität | nur bei Buchung                                      |
| Gesundheit und Fitness: Gesundheit | Ja                          | App-Funktionalität | Fachrichtung/Anlass einer Buchung, Termin-Alarme     |
| Standort: Ungefährer Standort      | Ja                          | App-Funktionalität | gerundet; bei Termin-Alarmen gespeichert             |
| Käufe: Kaufverlauf                 | Ja                          | App-Funktionalität | Stufe, Produkt, Ablaufdatum                          |
| Kennungen: Nutzer-ID               | Ja                          | App-Funktionalität | pseudonyme Konto-ID (auch an RevenueCat)             |
| Diagnose: Absturzdaten             | Nein                        | App-Funktionalität | **nur bei eingerichteten Absturzberichten (Opt-in)** |

## Zugang für die Prüfung (Apple und Google)

Die Prüferinnen und Prüfer müssen Buchung und Termin-Alarm ausprobieren können. Die App meldet über einen
E-Mail-Code an – den bekommen Prüfer nicht.

[PLATZHALTER: Vor der ersten Einreichung entscheiden – z. B. ein eigenes Prüfkonto mit Postfach, dessen
Zugangsdaten in den Prüfhinweisen stehen, oder ein fester Prüfcode nur für eine bestimmte Adresse]

Prüfhinweise (Vorschlag):

> MedNow arranges doctor appointments in Germany. It does not provide diagnoses or medical advice. During
> the pilot phase only a few practices in [PLATZHALTER: city] publish real appointments; demo practices are
> labelled "Demo". Booking and appointment alerts require email verification: [PLATZHALTER: Prüfzugang].
> In-app purchases: MedNow Plus (30-day non-renewing pass, yearly subscription) and MedNow Family (yearly
> subscription). Paying never changes the order of appointment alerts.
