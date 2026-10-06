# Legal-Checkliste (vor Launch anwaltlich prüfen)

> Diese Liste ist eine technische Vorbereitung, **keine Rechtsberatung**. Alle Punkte sind vor dem Launch
> mit einer Fachanwältin/einem Fachanwalt für IT- und Medizinrecht sowie der/dem Datenschutzbeauftragten zu klären.

## 1. Datenschutz (DSGVO, BDSG, TDDDG)

- [ ] **Datenschutz-Folgenabschätzung (Art. 35 DSGVO)** – Verarbeitung von Gesundheitsdaten (Art. 9) in größerem Umfang; Termin bei einer Fachrichtung kann Gesundheitszustand offenbaren.
- [ ] **Rechtsgrundlagen festlegen und dokumentieren**
  - Buchung/Warteliste: ausdrückliche Einwilligung Art. 9 Abs. 2 lit. a DSGVO (umgesetzt: separater, nicht vorangekreuzter Schritt, versioniert in `consents`, widerrufbar im Datenschutz-Center).
  - Vertragsdurchführung Art. 6 Abs. 1 lit. b für Kontoführung.
  - Absturzberichte: Opt-in (umgesetzt, standardmäßig aus).
- [ ] **Einwilligungstext** (`booking.consentText`) juristisch prüfen; Versionsnummer `HEALTH_CONSENT_VERSION` bei Änderungen erhöhen.
- [ ] **Verzeichnis von Verarbeitungstätigkeiten** (Art. 30).
- [ ] **Datenschutzbeauftragte/r** benennen (Pflicht bei umfangreicher Verarbeitung besonderer Kategorien, § 38 BDSG).
- [ ] **Löschfristen** bestätigen (umgesetzt in `app.retention()`):
  - Push-Outbox 30 Tage, Warteliste-Angebote 90 Tage, beendete Wartelisten 90 Tage,
  - vergangene Termine inkl. Kontaktdaten **12 Monate** – mit Praxen und Aufbewahrungspflichten abgleichen.
- [ ] **TDDDG § 25**: Zugriff auf Endgerät (Push-Token, lokale Speicherung) – Erforderlichkeit dokumentieren.
- [ ] **Betroffenenrechte**: Export (Art. 15/20) und Löschung (Art. 17) sind in der App umgesetzt – Prozess für Anfragen außerhalb der App definieren.

## 2. Auftragsverarbeitung (Art. 28 DSGVO)

| Dienstleister                                               | Zweck                                      | Region                        | AVV / DPA                           | Drittlandtransfer                         |
| ----------------------------------------------------------- | ------------------------------------------ | ----------------------------- | ----------------------------------- | ----------------------------------------- |
| Supabase Inc.                                               | Datenbank, Auth, Edge Functions, Realtime  | eu-central-1 (Frankfurt)      | [ ] abschließen                     | US-Mutterkonzern → SCC/DPF prüfen         |
| Expo (650 Industries)                                       | Push-Zustellung, Builds, Updates           | USA                           | [ ] abschließen                     | SCC/DPF prüfen; Push-Inhalte datensparsam |
| Apple (APNs) / Google (FCM)                                 | Push-Zustellung                            | global                        | Plattformbedingungen                | ja                                        |
| Sentry (EU-Region) oder GlitchTip (selbst gehostet)         | Absturzberichte (Opt-in)                   | Frankfurt / eigener EU-Server | [ ]                                 | Sentry: US-Mutterkonzern                  |
| Kartenkacheln (OpenFreeMap / eigener Tileserver)            | Kartendarstellung                          | DE/EU                         | [ ] bei eigenem Betrieb nicht nötig | IP-Adresse wird übertragen                |
| E-Mail-Versand für Codes (Supabase SMTP / eigener Anbieter) | Verifizierung (App), Anmeldung (Dashboard) | [ ] EU-Anbieter wählen        | [ ]                                 |                                           |
| Hosting Praxis-Dashboard (statische Seite)                  | Auslieferung der Web-App                   | [ ] EU-Hoster wählen          | [ ]                                 |                                           |

## 3. Pflichtangaben und Texte

- [ ] **Impressum** (§ 5 DDG) – Platzhalter in `legal.imprintBody`.
- [ ] **Datenschutzerklärung** – Platzhalter in `legal.privacyBody`.
- [ ] **Nutzungsbedingungen** – Vermittlung, Stornoregeln, Haftung, kein Behandlungsvertrag mit MedNow.
- [ ] **Vereinbarungen mit Praxen** (Phase 6): Datenverarbeitung, Pflegepflichten für Slots, Verantwortlichkeiten (gemeinsame Verantwortlichkeit Art. 26 bzw. Auftragsverarbeitung Art. 28 prüfen), Pflicht zur Zwei-Faktor-Anmeldung, Umgang mit Absagen.
- [ ] **Zugriffsprotokoll** der Praxen (`app.practice_audit_log`, 12 Monate) – Zweck, Frist und Auskunftsprozess festlegen.
- [ ] **Benachrichtigung bei Praxis-Absage** (Push ohne Details) – Text und Pflicht zur direkten Information durch die Praxis klären.

## 4. Medizinprodukte, Berufs- und Wettbewerbsrecht

- [ ] **Keine Medizinprodukte-Eigenschaft (MDR)** bestätigen: keine Diagnose, keine Triage, kein Symptom-Checker (umgesetzt: nur Kategorien, keine Freitexte, kein Ranking nach Dringlichkeit von Beschwerden).
- [ ] **Heilmittelwerbegesetz / UWG**: Darstellung von Praxen, Bewertungen (aktuell nur Durchschnitt, keine Einzelbewertungen), keine bezahlte Bevorzugung ohne Kennzeichnung.
- [ ] **Berufsrecht** der Ärztinnen und Ärzte (Zuweisung gegen Entgelt, § 31 MBO-Ä) bei künftigen Geschäftsmodellen.
- [ ] Notfallhinweise 112 / 116117 sichtbar (umgesetzt auf Start, Akut-Modus, Hilfe).

## 5. Barrierefreiheit (BFSG seit 28.06.2025)

- [ ] Anwendbarkeit klären (Kleinstunternehmen-Ausnahme gilt nur für Dienstleistungen, nicht dauerhaft planbar).
- [ ] **Barrierefreiheitserklärung** veröffentlichen (Platzhalter in `legal.accessibilityBody`), inkl. Kontakt für Barrieren und Hinweis auf die Marktüberwachungsbehörde.
- [ ] Audit nach WCAG 2.1 AA / EN 301 549 mit echten Nutzenden (VoiceOver, TalkBack, Schalterbedienung) – siehe `docs/accessibility-audit.md`.

## 6. App-Stores

- [ ] **Apple App Privacy** (Nutrition Label): Gesundheitsdaten? (Termin-Kontext), Kontaktinfos (Name, Telefon, E-Mail), Kennungen (Nutzer-ID), Diagnosedaten (nur Opt-in). Kein Tracking.
- [ ] **Google Play Data Safety**: entsprechend; Datenlöschung in der App vorhanden.
- [ ] **Datenschutz-Manifest iOS** (`PrivacyInfo.xcprivacy` über `app.config.ts` → `privacyManifests`) prüfen.
- [ ] Gesundheits-App-Richtlinien (Apple 1.4.1, 5.1.3; Google Health Apps Policy) – Nachweis der Berechtigung/Partnerschaften.
- [ ] Markenrecherche „MedNow“ (DPMA, EUIPO, App Stores) – Name zentral in `src/config/brand.ts`.

## 7. 116117 (falls weiterverfolgt)

- [ ] Verfahrensordnung und Prüfpaket der KBV, Zertifizierung, Datenschutzkonzept – siehe `docs/116117-spike.md`.
