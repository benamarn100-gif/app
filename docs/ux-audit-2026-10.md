# UI/UX- und Animations-Audit (Oktober 2026)

> Stand: 06.10.2026. Grundlage: Code-Durchsicht und ein Durchgang durch alle Screens in der Web-Vorschau
> (390 × 844, hell und dunkel, Playwright). Native Besonderheiten (Tab-Bar, Sheets, Haptik) aus dem Code.

## Phase 0 – Bestand (Kurzfassung)

1. **Stack:** Expo SDK 57 (React Native 0.86, neue Architektur), TypeScript strict, Expo Router (Dateirouten in `src/app`).
2. **Navigation:** Stack + native Tabs (Start, Suche, Termine, Profil); Buchung, Filter, Standort als native Form-Sheets.
3. **State:** TanStack Query (Server-Zustand, Offline-Cache) + Zustand (Einstellungen, Filter), persistiert mit sicherem Speicher-Fallback.
4. **Design-System:** Tokens in `src/design/tokens.ts` (Farben hell/dunkel, Typo-Skala, 4/8-pt-Raster, Radien, Schatten, Motion); `makeStyles` – keine hartcodierten Farben im Code gefunden.
5. **Animationen:** Reanimated 4 (UI-Thread): Feder-Press-Feedback, gestaffelte Listen, Skeletons, Lottie-freie Illustrationen; „Bewegung reduzieren“ wird überall beachtet.
6. **Daten:** Repository-Schnittstelle mit zwei Umsetzungen – Demo (`MemoryRepository`, auf dem Gerät) und Supabase (Frankfurt, RLS, Edge Functions, Realtime).
7. **Bereits vorhanden:** Suche mit Filtern (Fachrichtung, Umkreis, Zeitfenster, Sprache, Barrierefreiheit, Kasse/privat, Video), Karte, Akut-Modus, Buchung mit Reservierung, Warteliste mit Push, Familie, Kalender, Erinnerungen 24 h/2 h, Datenschutz-Center, Praxis-Dashboard.
8. **Qualität:** 81 App-Tests, 95 Datenbank-Tests, axe-geprüfte Barrierefreiheit, Bundle-Budget in CI, Startzeit-Messung.
9. **Anpassung:** Alle folgenden Schritte nutzen diesen Stack; neue Bibliotheken nur für In-App-Käufe (RevenueCat).

## Phase 1 – Befunde

| # | Schwere | Bereich | Befund | Maßnahme |
| --- | --- | --- | --- | --- |
| K1 | kritisch | Start | Der nächste Termin steht als 7. von 8 Blöcken ganz unten; die Startseite beantwortet die zwei Kernfragen nicht in 3 Sekunden | Dashboard neu (Phase 2): Hero = nächster Termin, Suche mit Schnellfiltern, „Frei in deiner Nähe“ |
| K2 | kritisch | Akut | „Heute“ endet um Mitternacht: ab dem Abend zeigen Start und Akut-Modus fast immer „heute alles vergeben“, obwohl morgen früh Termine frei sind | Zeitfenster „nächste 24 Stunden“ (App, Demo, Datenbank) |
| K3 | kritisch | Start | Doppelte Aussagen: Hero „heute alles vergeben“ und darunter Block „heute nichts frei“; dazu Wochenliste und Kartenvorschau mit denselben Praxen | Ein Block je Aussage (Phase 2) |
| M1 | mittel | Animation | Listen springen beim Entfernen/Einfügen (Storno, Filterwechsel, Alarm löschen) | Layout-Übergänge auf dem UI-Thread (`LinearTransition`), bei „Bewegung reduzieren“ aus |
| M2 | mittel | Suche | Kein Pull-to-Refresh in der Suche (Start und Termine haben es) | Ergänzen, mit Marken-Animation |
| M3 | mittel | Praxis | Kopfbereich mit großer Illustration schiebt Termine unter die Falz | Kopf kompakter, Termine früher sichtbar |
| M4 | mittel | Sicherheit | Notrufnummern nur als Leiste; keine Notapotheke, keine Krisen-Hotline | Eigene Notfall-Seite (Phase 3.8) |
| M5 | mittel | Karte | Nur Luftlinie; keine Einschätzung, wie lange man braucht | Geschätzte Gehzeit/Fahrzeit (klar als „ca.“ markiert), Route je Verkehrsmittel (Phase 3.3) |
| M6 | mittel | Haptik | Kein haptisches Signal beim Setzen eines Termin-Alarms (nur Toast) | Erfolgs-Haptik beim Alarm |
| F1 | Feinschliff | Start | Begrüßung + Standort-Chip brauchen zwei Zeilen | Eine Zeile |
| F2 | Feinschliff | Start | Fachrichtungs-Chips abgeschnitten, ohne Hinweis auf Scrollen | In die Schnellfilter der Suche verlegt |
| F3 | Feinschliff | Web | Tab-Bar-Schriftgröße im Web als Zahl statt Token | Token verwenden |

Geprüft und in Ordnung: Farb-Tokens (keine Hex-Werte außerhalb der Tokens), Typo-Skala, 4/8-pt-Raster, Radien,
Schatten, dunkles Design (Kontrast 98/98 Paare AA), Safe Areas, Tastatur-Verhalten in Formularen
(`KeyboardAvoidingView`), Skeletons statt Spinner (kein `ActivityIndicator` im Code), Press-Feedback mit Feder,
native Sheets mit Gesten, Haptik bei Buchung, „Bewegung reduzieren“, Touch-Ziele 48 pt, Screenreader (axe, D-58),
FlashList in langen Listen, Bundle-Budget, Startzeit-Messung.

Motion-Standard (unverändert, überall genutzt): Feder `damping 18 / stiffness 220`, Dauer 150/220/300 ms,
Press-Skalierung 0,97, Stagger 40 ms für höchstens 8 Elemente.

## Umsetzung

Reihenfolge: K2, M1–M3, M6, F1–F3 in Phase 1; K1/K3 in Phase 2; M4, M5 in Phase 3.
Ergebnisse und Abweichungen stehen im Abschlussbericht (`docs/release-notes-2026-10.md`).
