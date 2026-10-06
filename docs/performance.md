# Performance

> Stand: 06.10.2026. Ziele aus der Vorgabe: Kaltstart < 2 s, 60 fps beim Scrollen, Bilder mit Blurhash,
> Offline-Cache, Bundle-Überwachung. Werte auf echten Geräten sind noch zu messen (siehe Abschnitt 4).

## 1. Maßnahmen im Code

| Bereich   | Maßnahme                                                                                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start     | Schriften als einzelne Gewichte (keine Variable Fonts), Splash bis Schriften + Einstellungen geladen sind; Demo-Daten werden erst **nach dem ersten Frame** erzeugt (Seed-Generator 230 → 70 ms, D-40); Sentry wird erst nach Einwilligung geladen (`require` im Opt-in-Pfad) |
| Bundle    | Icons einzeln (`src/components/icons.ts`) statt aus dem Lucide-Barrel, date-fns-Funktionen einzeln – ESLint verhindert Rückfälle; Budget-Prüfung in CI (`npm run check:bundle`)                                                                                               |
| Listen    | FlashList für Suche und Akut-Modus; Karten-Komponenten `memo`; Stagger-Animation nur für die ersten 8 Einträge                                                                                                                                                                |
| Animation | Reanimated (UI-Thread), Federn statt Zeitkurven, „Bewegung reduzieren“ respektiert                                                                                                                                                                                            |
| Daten     | TanStack Query: `staleTime` 60 s, Offline-Cache (AsyncStorage) nur für öffentliche Daten; Realtime-Änderungen patchen Slot-Listen direkt, Suchergebnisse werden gebündelt (1,2 s) neu geladen                                                                                 |
| Netz      | Suche liefert Status, Zähler, nächsten Slot und Aktualität in **einem** RPC (`search_availability`); Standort auf ~110 m gerundet (Cache-Treffer)                                                                                                                             |
| Bilder    | `expo-image` mit Blurhash-Platzhaltern und Disk-Cache                                                                                                                                                                                                                         |
| Karte     | Clustering in MapLibre, Pins als vorab erzeugte PNGs (keine React-Views je Pin)                                                                                                                                                                                               |
| Dashboard | Code-Splitting: Demo-Generator und Supabase-Client in getrennten Chunks (Hauptbundle 91 KB gzip)                                                                                                                                                                              |

## 2. Gemessene Bundle-Größen (Produktions-Export)

| Plattform                 | vorher                 | nachher                         | Budget (CI) |
| ------------------------- | ---------------------- | ------------------------------- | ----------- |
| Android (Hermes-Bytecode) | –                      | 8,49 MB (gzip 3,58 MB)          | 9,3 MB      |
| Web (JS, minifiziert)     | 7,44 MB (gzip 1,45 MB) | 5,11 MB (gzip 1,22 MB)          | 5,6 MB      |
| Praxis-Dashboard (JS)     | 619 KB (gzip 179 KB)   | Haupt-Chunk 295 KB (gzip 91 KB) | –           |

Größte verbleibende Anteile (Quelltext vor Minifizierung): expo-router, Reanimated, react-native-web (nur Web),
zod (Kern, auch in `zod/mini` enthalten – Umstieg lohnt kaum), Supabase-Client, Sentry (nur nach Opt-in ausgeführt).

## 3. Kennzahlen in Tests

- Seed-Generator: ~7 000 Slots in ~70 ms (Desktop), läuft nach dem ersten Frame.
- Doppelbuchung: 50 parallele Buchungen → genau 1 Erfolg (`npm run db:test`).
- Suche (SQL): Geo-Index (GiST) + Geohash-Spalte; Zeitfenster DST-sicher über `app.window_bounds`.

## 4. Noch zu messen (echte Geräte, Release-Build)

Werkzeuge (D-57, `docs/test-builds.md` §6): Testversion (`preview`) installieren, dann

- **Android:** `scripts/measure-startup.sh 10` – Prozessstart → erstes Bild → bedienbar, Mediane über 10 Läufe
- **iOS:** Xcode Instruments „App Launch“; JS-Anteil auf der Diagnose-Seite (Profil → Testversion & Diagnose)

| Gerät | Build | erstes Bild | bedienbar | davon JS | Datum |
| ----- | ----- | ----------- | --------- | -------- | ----- |
| –     | –     | –           | –         | –        | –     |

1. **Kaltstart** bis bedienbar auf einem Mittelklasse-Android (z. B. Pixel 6a) und iPhone 12. Ziel < 2 s.
2. **Scrollen** in Suche und Akut-Modus mit 60 Ergebnissen: Perf-Monitor (Entwicklermenü) bzw. Android GPU-Profiling. Ziel 60 fps, keine JS-Frame-Einbrüche > 16 ms.
3. **Speicher** nach 10 Minuten Nutzung inkl. Karte.
4. **Netz:** Suche bei 3G-Drosselung < 1,5 s bis zur ersten Liste (Skeletons ab 0 ms).

Ergebnisse hier eintragen; offene Punkte stehen in `TODO.md`.
