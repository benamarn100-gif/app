# Rechtstexte – Hinweise für die anwaltliche Prüfung

> Stand: 07.10.2026. Technische Vorbereitung, **keine Rechtsberatung**.

## Was hier liegt

| Datei                             | Inhalt                                                                  | Veröffentlicht als      |
| --------------------------------- | ----------------------------------------------------------------------- | ----------------------- |
| `datenschutz.md`                  | Datenschutzerklärung für App, Webseite und Praxis-Dashboard             | `/datenschutz/`         |
| `nutzungsbedingungen.md`          | Nutzungsbedingungen inkl. Abo-Bedingungen, Widerrufsbelehrung, Formular | `/nutzungsbedingungen/` |
| `impressum.md`                    | Impressum-Vorlage                                                       | `/impressum/`           |
| `../pilot/praxis-vereinbarung.md` | Entwurf der Vereinbarung mit Pilotpraxen                                | nicht öffentlich        |

Die Webseite wird mit `npx tsx scripts/build-website.ts` aus diesen Dateien gebaut (Workflow „Webseite und
Praxis-Dashboard bereitstellen“). Platzhalter erscheinen dort gelb markiert, der Entwurfshinweis bleibt
sichtbar, bis er in der Datei entfernt wird.

Grundlage: `docs/legal-checklist.md` (Dienstleister, Rechtsgrundlagen, Löschfristen), `docs/billing-setup.md`
(Abo), `docs/architecture.md`, Migrationen in `supabase/migrations/` (z. B. `app.retention()`).

## Offene Rechtsfragen (bitte entscheiden)

1. **Vertragspartner bei In-App-Käufen:** Apple und Google treten unterschiedlich auf (Händler bzw.
   Vermittler). Wer belehrt über das Widerrufsrecht, wer erstattet? Abschnitt 7.3 und 8 der
   Nutzungsbedingungen danach anpassen.
2. **Widerrufsrecht bei Plus/Familie:** digitaler Inhalt (§ 356 Abs. 5 BGB) oder digitale Dienstleistung
   (§ 356 Abs. 4 BGB)? Ist ein vorzeitiges Erlöschen zulässig, und wo im Kaufablauf müsste die
   Zustimmung eingeholt werden?
3. **Verhältnis zu den Praxen:** gemeinsame Verantwortlichkeit (Art. 26 DSGVO) oder Auftragsverarbeitung
   (Art. 28)? Davon hängen Datenschutzerklärung (Abschnitt 6/8) und Praxis-Vereinbarung ab.
4. **Einwilligung in Gesundheitsdaten für Angehörige** (Art. 9 Abs. 2 lit. a DSGVO): Reicht die
   Einwilligung der buchenden sorgeberechtigten Person? Altersgrenze für eigene Konten (Entwurf: 16).
5. **Drittlandübermittlungen:** Expo (Push, Updates), RevenueCat (Kaufverwaltung), Apple, Google; Supabase
   mit US-Mutter (Server Frankfurt) – Datenschutzrahmen (DPF) bzw. Standardvertragsklauseln je Anbieter.
6. **Löschfristen:** vergangene Termine samt Kontaktdaten 12 Monate, Zugriffsprotokoll der Praxen
   12 Monate – mit Aufbewahrungspflichten der Praxen abgleichen.
7. **Datenschutzbeauftragte/r und Datenschutz-Folgenabschätzung** (Art. 35 DSGVO, § 38 BDSG).
8. **Barrierefreiheitsstärkungsgesetz:** Anwendbarkeit und Barrierefreiheitserklärung.
9. **Nach Ablauf eines Abos** bleibt Eingerichtetes bestehen (laufende Alarme, Profile; ein bereits
   eingeschalteter Kalender-Sync läuft weiter). Ist das so gewollt und so richtig beschrieben (7.6)?
10. **Verbraucherstreitbeilegung:** Angabe nach § 36 VSBG. (Die EU-Plattform zur Online-Streitbeilegung
    wurde im Juli 2025 eingestellt – kein Link mehr nötig.)

## Platzhalter, die der Betreiber ausfüllt

- Name/Firma mit Rechtsform, ladungsfähige Anschrift, Vertretungsberechtigte, Register, USt-IdNr.
- E-Mail für Support und Datenschutz, Telefon
- Datenschutzbeauftragte/r (falls benannt)
- Adresse der Webseite und des Praxis-Dashboards (Domain)
- E-Mail-Anbieter (z. B. Brevo SAS, Paris) und Webhoster mit Sitz und AV-Vertrag
- Verbraucherstreitbeilegung (§ 36 VSBG)

## Vor der Veröffentlichung

- [ ] Alle `[PLATZHALTER: …]` ersetzt, Entwurfshinweis in Zeile 3 jeder Datei entfernt
- [ ] AV-Verträge abgeschlossen: Supabase, Expo, RevenueCat, E-Mail-Anbieter, Webhoster
      (Apple/Google: Plattformbedingungen)
- [ ] Texte in der App (`legal.*` in `src/i18n/locales/*.json`) mit den geprüften Fassungen abgeglichen
      oder auf die Webseite verlinkt
- [ ] Einwilligungstext Gesundheitsdaten geprüft; bei Änderung `HEALTH_CONSENT_VERSION` erhöhen
