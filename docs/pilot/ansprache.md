# Pilotpraxen ansprechen

> Stand: 12.10.2026. Kandidaten kommen aus dem Praxisverzeichnis (OpenStreetMap), die Briefe aus
> `scripts/build-pilot-letters.ts`. Absenderangaben stehen nur in den KONTAKT\_\*-Werten, nie im Repository.

## Warum per Brief

- **E-Mail nur mit Einwilligung.** Werbung per E-Mail – auch über Kontaktformulare – ist ohne vorherige
  ausdrückliche Einwilligung unzulässig, auch gegenüber Praxen (§ 7 Abs. 2 Nr. 2 UWG). Nach einer Antwort
  der Praxis ist E-Mail natürlich in Ordnung.
- **Kein Kaltanruf.** Anrufe bei Unternehmen sind nur mit zumindest mutmaßlicher Einwilligung erlaubt
  (§ 7 Abs. 2 Nr. 1 UWG). Erst anrufen, wenn die Praxis sich gemeldet oder einen Rückruf gewünscht hat.
- **Brief ist erlaubt** – außer an Praxen mit sichtbarem „Keine Werbung“-Hinweis am Briefkasten.
- Der Brief informiert zugleich, dass die Praxis im Verzeichnis steht, woher die Angaben stammen und
  wie sie widersprechen kann (Art. 14 und 21 DSGVO; Prüfung durch die Kanzlei, siehe
  `docs/legal/README.md`, Frage 11).

## Ablauf

1. Kandidatenliste öffnen (Tabelle „Pilotpraxen“), 10–20 Praxen auswählen. Am besten zuerst in der Nähe
   (Fulda und Umgebung): Dort ist ein Besuch möglich, und die erste Praxis profitiert vom persönlichen
   Probelauf.
2. Briefe drucken (eine Seite je Praxis) und jeweils die **Praxis-Mappe** beilegen (Infoblatt und
   Datenblatt, 2 Blätter). Fensterumschlag DL oder C5/6, Porto Standardbrief.
3. In der Tabelle „Brief verschickt“ und das Datum eintragen.
4. Meldet sich eine Praxis: 15-Minuten-Gespräch, dann Datenblatt zurück → Praxis anlegen
   (`docs/pilot/praxis-onboarding.md`). Voraussetzung: E-Mail-Versand eingerichtet
   (`docs/email-setup.md`), sonst kommt der Anmeldecode nicht an.
5. **Widerspruch** („bitte nicht im Verzeichnis“): GitHub → Actions → „Praxisverzeichnis importieren“ →
   „Eintrag entfernen“ mit dem OSM-Verweis aus der Tabelle. Eintrag ist sofort weg und kommt nie wieder.

## Briefe neu erzeugen

```bash
KONTAKT_NAME=… KONTAKT_ANSCHRIFT="Straße 1, 12345 Ort" KONTAKT_TELEFON=… KONTAKT_EMAIL=… \
CHROMIUM_PATH=/pfad/zu/chrome npx tsx scripts/build-pilot-letters.ts praxen.json briefe.pdf
```

`praxen.json`: Liste mit `name`, `street`, `plz`, `city`, `specialty` und optional `nearby` (Besuch vor
Ort möglich).
