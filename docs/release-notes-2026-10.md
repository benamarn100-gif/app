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
