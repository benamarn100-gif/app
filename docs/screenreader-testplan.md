# Screenreader-Prüfplan (VoiceOver und TalkBack)

> Stand: 06.10.2026. Ergänzt `docs/accessibility-audit.md` §4 um konkrete Schritte und die **erwarteten
> Ansagen**. Prüfen mit der Testversion (`docs/test-builds.md`); Datum, Gerät und Ergebnis unten eintragen.
> Die erwarteten Texte stammen aus `src/i18n/locales/de.json` (Ansprache „du“); Zahlen und Uhrzeiten variieren.

## 1. Vorbereitung

|                 | iOS (VoiceOver)                                                    | Android (TalkBack)                                                            |
| --------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Einschalten     | Einstellungen → Bedienungshilfen → VoiceOver (oder Seitentaste 3×) | Einstellungen → Bedienungshilfen → TalkBack (oder beide Lautstärketasten 3 s) |
| Weiter / zurück | nach rechts / links wischen                                        | nach rechts / links wischen                                                   |
| Aktivieren      | Doppeltippen                                                       | Doppeltippen                                                                  |
| Regler ändern   | nach oben / unten wischen                                          | Lautstärketasten (bei Fokus auf dem Regler)                                   |
| Überschriften   | Rotor auf „Überschriften“, dann nach unten wischen                 | Lesesteuerung „Überschriften“ (nach oben/unten wischen)                       |

Vorher: Testversion frisch installieren (Einführung erscheint), Sprache Deutsch, Diagnose-Seite zeigt
„Screenreader: An“. Jeden Ablauf zusätzlich mit **Schrift 200 %** und **Querformat** wiederholen.

## 2. Abläufe mit erwarteten Ansagen

Spalte „Erwartet“: sinngemäß, Reihenfolge wie angegeben. Rolle und Zustand sagt das System selbst an
(„Taste“, „Überschrift“, „ausgewählt“, „deaktiviert“ …).

### A. Einführung und Start

| #   | Aktion                       | Erwartet                                                                                                                                                                                                               |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | App öffnen                   | Erstes Element der Einführung; Titel als Überschrift                                                                                                                                                                   |
| A2  | Durch die Einführung wischen | Alle Texte, dann „Überspringen“ bzw. „Weiter“ als Taste; Fortschritt „Schritt x von 3“                                                                                                                                 |
| A3  | Auswahl „Für wen“            | Optionen als Optionsfeld mit „ausgewählt“/„nicht ausgewählt“                                                                                                                                                           |
| A4  | Startseite                   | „Guten Morgen/Tag/Abend“ als Überschrift, dann Standort-Taste                                                                                                                                                          |
| A5  | Akut-Schaltfläche            | „Ich brauche heute einen Termin. Wir zeigen dir sofort, wo heute noch etwas frei ist. Heute noch 3 Praxen mit freien Terminen, Taste“ – Hinweis: „Zeigt Praxen in der Nähe, sortiert nach dem frühesten freien Termin“ |
| A6  | Notfall-Leiste               | „Ärztlichen Bereitschaftsdienst 116117 anrufen“ und „Notruf 112 anrufen“, je als Taste                                                                                                                                 |
| A7  | Tab-Leiste                   | „Start“, „Suche“, „Termine“, „Profil“ als Tab, aktueller Tab „ausgewählt“                                                                                                                                              |

### B. Akut buchen (Kernablauf)

| #   | Aktion                       | Erwartet                                                                                                                                                                                                                |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Akut-Schaltfläche aktivieren | Bildschirm „Heute frei“, erste Praxiskarte erreichbar                                                                                                                                                                   |
| B2  | Praxiskarte                  | **eine** Ansage: „Name, Fachrichtung, 7 freie Termine, Videosprechstunde, Morgen 07:30 · 1,6 km, Verfügbarkeit aktualisiert vor 2 Min., Bewertung 3,8 von 5 bei … Bewertungen, Demo-Praxis mit erfundenen Daten, Taste“ |
| B3  | Praxis öffnen                | Praxisname als Überschrift; Verfügbarkeits-Banner als eine Ansage („Gute Chancen: … · Verfügbarkeit aktualisiert vor …“)                                                                                                |
| B4  | Tagesleiste                  | „Morgen 7.10. 2 freie Termine, Tab, ausgewählt“; Tage ohne Termine „… 0 freie Termine, deaktiviert“                                                                                                                     |
| B5  | Uhrzeit wählen               | „07:30, Dr. …, Optionsfeld, nicht ausgewählt“ → nach Doppeltippen „ausgewählt“                                                                                                                                          |
| B6  | „Termin buchen“              | Buchungsblatt öffnet; Fokus im Blatt, nicht dahinter                                                                                                                                                                    |
| B7  | Reservierung                 | „Reservierung läuft noch 5 Minuten“; **eine Minute vor Ablauf** ohne Fokuswechsel: „Noch eine Minute, dann wird der Termin wieder freigegeben.“                                                                         |
| B8  | Schritte                     | Schrittname als Überschrift („Termin“, „Für wen“, „Anlass“, „Bestätigen“)                                                                                                                                               |
| B9  | Kontaktfelder leer absenden  | Fehlermeldung wird sofort vorgelesen (Rolle „Warnung/Alert“), Feld bleibt beschriftet                                                                                                                                   |
| B10 | Einwilligung                 | Kontrollkästchen mit vollständigem Einwilligungstext, „nicht aktiviert“ → „aktiviert“                                                                                                                                   |
| B11 | Abschicken                   | Erstes Element danach: Überschrift „Geschafft! Dein Termin ist gebucht.“ (sonst Befund)                                                                                                                                 |

### C. Suche, Filter, Karte

| #   | Aktion                | Erwartet                                                                                                                                    |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Suchfeld              | „Praxis oder Fachrichtung suchen, Suchfeld“ (iOS) bzw. „Bearbeitungsfeld“ (Android)                                                         |
| C2  | Filter → Fachrichtung | Chips als Kontrollkästchen mit „aktiviert/nicht aktiviert“                                                                                  |
| C3  | Umkreis-Regler        | „Umkreis, 10 km, anpassbar“ – nach oben wischen: „15 km“                                                                                    |
| C4  | Umkreis-Chips         | „2 km“ … als Optionsfeld, gewählter „ausgewählt“                                                                                            |
| C5  | Karte                 | Kartenvorschau auf der Startseite ist ausgeblendet; in der Suche ist die Liste immer per Umschalter erreichbar und enthält dieselben Praxen |

### D. Warteliste und Angebot

| #   | Aktion                    | Erwartet                                                                        |
| --- | ------------------------- | ------------------------------------------------------------------------------- |
| D1  | „Sag mir Bescheid“        | Zeitraum-Optionen als Optionsfelder                                             |
| D2  | Eintragen                 | Bestätigung als Hinweis (Toast) wird vorgelesen, ohne den Fokus zu verlieren    |
| D3  | Angebot (Demo nach ~20 s) | „Ein Termin ist frei geworden!“; „Offenes Terminangebot, läuft noch 10 Minuten“ |
| D4  | Eine Minute vor Ablauf    | „Noch eine Minute, dann geht der Termin an die nächste Person.“                 |

### E. Termine verwalten

| #   | Aktion        | Erwartet                                                                             |
| --- | ------------- | ------------------------------------------------------------------------------------ |
| E1  | Tab „Termine“ | Segmente „Kommend“/„Vergangen“ als Optionsfeld                                       |
| E2  | Terminkarte   | eine Ansage mit Praxis, Datum, Uhrzeit, Person                                       |
| E3  | „Stornieren“  | System-Dialog „Termin stornieren?“ mit „Abbrechen“ und „Stornieren“; Fokus im Dialog |
| E4  | Bestätigen    | „Termin storniert“ wird vorgelesen                                                   |

### F. Profil, Datenschutz, Diagnose

| #   | Aktion                        | Erwartet                                                                                                |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| F1  | Einstellungszeilen            | Titel, dann Beschreibung als Hinweis (z. B. „Familie … Familienmitglieder, für die du Termine buchst.“) |
| F2  | Darstellung/Sprache/Ansprache | Segmente als Optionsfeld mit Zustand                                                                    |
| F3  | Datenschutz-Center            | Einwilligungen mit Datum; „Widerrufen“ → System-Dialog                                                  |
| F4  | Testversion & Diagnose        | Jede Zeile als **eine** Ansage „Bezeichnung: Wert“                                                      |

## 3. Querschnitt (bei jedem Ablauf)

- Keine unbeschrifteten Elemente („Taste“ ohne Namen), keine Symbole einzeln angesagt.
- Reihenfolge folgt der sichtbaren Anordnung; nichts hinter Blättern/Dialogen erreichbar.
- Farbe nie alleiniger Träger: Status immer auch als Text („Frei“, „Wenige frei“, „Ausgebucht“, „Unbekannt“).
- Demo-Praxen werden als solche angesagt.
- Animationen respektieren „Bewegung reduzieren“.
- Schrift 200 %: nichts abgeschnitten, alles per Wischen erreichbar; Querformat ohne Funktionsverlust.

## 4. Automatische Vorprüfung (Web, axe-core)

Vor jedem Gerätetest: Web-Export der App mit axe-core (WCAG 2.1 A/AA + Best Practices) auf Einführung,
Start, Akut, Praxis, Buchung, Suche, Termine, Profil, Datenschutz, Familie, Diagnose, Filter, Standort,
Erklärung. Stand 06.10.2026 nach den Korrekturen (D-58): **keine Verstöße** außer der experimentellen
Regel `label-content-name-mismatch` an Karten und Zeilen. Diese Fundstellen sind Artefakte von
react-native-web (Texte als getrennte `div`s ohne Leerzeichen); die Namen beginnen mit dem sichtbaren
Text und enthalten alle sichtbaren Angaben (WCAG 2.5.3 erfüllt).

## 5. Ergebnisse

| Datum | Gerät / System | Screenreader | Ablauf | Ergebnis | Befund / Ticket |
| ----- | -------------- | ------------ | ------ | -------- | --------------- |
| –     | –              | –            | –      | –        | –               |

Prüfung möglichst mit Menschen, die Screenreader täglich nutzen (z. B. über Selbsthilfeverbände) – die
eigenen Prüfungen ersetzen das nicht.
