# Änderungsprotokoll Oktober 2026 – UI/UX, Dashboard, neue Funktionen, Abo

> Grundlage: Verbesserungs-Auftrag vom 06.10.2026 (Phasen 0–4). Audit und Befunde:
> `docs/ux-audit-2026-10.md`. Jede Funktion mit kurzem Nutzen-Text.

## Phase 1 – Modern & Animationen

- **Zeitfenster „Nächste 24 Std.“** – Nutzen: Auch abends sieht man ehrlich, wo es bald einen
  Termin gibt, statt „heute alles vergeben“.
- **Listen gleiten statt zu springen** (Storno, Alarm löschen, Familie) – Nutzen: ruhigeres
  Bild, man verliert die Orientierung nicht.
- **Pull-to-Refresh in der Suche** – Nutzen: gleiche Geste wie überall in der App.
- **Kompakter Praxis-Kopf** – Nutzen: freie Termine ohne Scrollen sichtbar.
- Server: Suche und Slot-Abfrage funktionieren jetzt auch mit den Spaltenrechten des Servers
  (vorher „permission denied“ für App-Nutzer).

## Phase 2 – Dashboard

- **Startseite in vier Blöcken**: nächster Termin (mit Route), Suche mit Schnellfiltern,
  „Frei in deiner Nähe“, Notruf-Leiste – Nutzen: die zwei Kernfragen in 3 Sekunden beantwortet.

## Phase 3 – Neue Funktionen

1. **Termin-Alarm** (Fachrichtung oder Praxis, 24 Std./3/7/14 Tage, Umkreis) mit Push und
   Direktbuchung – Nutzen: Der Termin kommt zu dir, niemand muss stündlich nachsehen.
2. **„Heute noch frei“** als Filter und eigener Tab „Heute“ (nächste 24 Std.) inkl.
   „Benachrichtige mich“ – Nutzen: ein Tipp bis zur Liste der schnellsten Termine.
3. **Anfahrt**: Karte/Liste wie bisher, dazu je Verkehrsmittel eine grobe Wegezeit („ca.“, aus der
   Luftlinie mit Umwegfaktor) und Route direkt im passenden Modus der Karten-App (Apple Karten,
   Google Maps, OpenStreetMap). ÖPNV ohne Schätzung – dafür fehlen Fahrplandaten. Nutzen: auf
   einen Blick sehen, ob die Praxis gut erreichbar ist.
4. **Kalender-Sync, Erinnerungen, „Jetzt losfahren“**: eigener Gerätekalender „MedNow“ (an/aus im
   Profil, Ausschalten löscht ihn), Erinnerungen 24 h/2 h wie bisher, neu „Zeit loszufahren“
   (Wegezeit + 10 Min. Puffer) als Mitteilung und im Termin-Hero. Nutzen: Kalender stimmt
   immer, niemand kommt zu spät. iOS braucht für den Sync den nächsten nativen Build
   (Kalender-Zugriffstext in der App-Konfiguration).
5. **Familienprofile**: „Ich“ mit eigener Altersgruppe plus Familienmitglieder (Spitzname +
   Altersgruppe, kein Geburtsdatum). „Für wen?“ in Filtern und Startseite: Fachrichtungen
   altersgerecht sortiert, Hausarzt ↔ Kinder- und Jugendarzt wird beim Wechsel getauscht, die
   Buchung übernimmt das Profil, Termine lassen sich je Person filtern. Nutzen: Eltern buchen
   für ihr Kind ohne Umwege. **Fehlt:** Altersgrenzen der Praxen (welche Praxis behandelt
   Kinder?) gibt die Datenquelle nicht her – deshalb kein harter Altersfilter auf Praxen.
6. **Favoriten und letzte Praxen**: „Merken“ auf der Praxisseite (nur auf dem Gerät gespeichert);
   Startseiten-Block „Deine Praxen“ mit gemerkten und zuletzt gebuchten Praxen, jeweils mit dem
   nächsten freien Termin und „Buchen“-Taste direkt in die Buchung. Nutzen: Wiederbuchen in zwei
   Taps.
7. **Notfall-Seite** („Notfall & Hilfe“, aus der Notruf-Leiste und dem Profil): 112 zuerst als
   große rote Taste, ärztlicher Bereitschaftsdienst 116117 (Anruf + 116117.de),
   Notdienst-Apotheke (Notdienstsuche der Apothekerkammern, 0800 00 22833 Festnetz kostenlos,
   22833 Handy), TelefonSeelsorge (0800 111 0 111, 0800 111 0 222, 116 123). Offline, ohne
   Anmeldung, nie Teil eines Abos, keine Diagnose. Nutzen: im Ernstfall nicht suchen müssen.
   **Fehlt:** eigene Apothekendaten („nächste Notapotheke“ führt zu aponet.de bzw. 22833).
