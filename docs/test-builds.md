# Testversionen (Expo/EAS)

> Stand: 06.10.2026. Testversionen nutzen **Demo-Daten auf dem Gerät** (kein Server nötig) und haben
> unter **Profil → Testversion & Diagnose** eine Diagnose-Seite. Veröffentlicht wird erst nach Abnahme.

## 1. Überblick

| Weg                                 | Ergebnis                                  | Braucht                                         |
| ----------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| EAS Build, Profil `preview`         | Android-APK mit Installationslink/QR-Code | Expo-Projekt mit GitHub verbunden (einmalig)    |
| EAS Build, Profil `preview` für iOS | Interne iOS-Version (Ad-hoc)              | Apple Developer Program, Geräte registriert     |
| EAS Build, `preview-simulator`      | iOS-Simulator-App (Mac mit Xcode)         | nur Expo                                        |
| EAS Update, Kanal `preview`         | Neue App-Logik ohne Neuinstallation       | vorhandener `preview`-Build                     |
| GitHub Actions „Android-Test-APK“   | APK als Artefakt (Debug-signiert)         | nichts – Ersatzweg, ohne EAS Update             |
| EAS Build, Profil `production`      | AAB (Play Store) / IPA (App Store)        | Store-Konten – **erst nach Abnahme einreichen** |

Das Expo-Projekt ist verknüpft: `extra.eas.projectId = 2fc9f403-cc00-478b-876d-9e2f6b78d1ab`
(`app.config.ts`, per `EAS_PROJECT_ID` überschreibbar). Der `slug` muss zum Projekt auf expo.dev passen (`mednow`).

## 2. Einmalig einrichten

1. **GitHub verbinden:** expo.dev → Projekt → _Project settings → GitHub_ → Repository
   `benamarn100-gif/app` verbinden. Danach lassen sich Builds und Workflows aus dem Repository starten
   (Expo-Dashboard, `eas workflow:run`, oder durch Claude über das Expo-Plugin).
2. **Android:** nichts weiter. EAS erzeugt beim ersten Build einen Signaturschlüssel und verwaltet ihn.
3. **iOS (optional):** Apple Developer Program (99 €/Jahr). Testgeräte mit `npx eas-cli device:create`
   registrieren (Link/QR-Code auf dem iPhone öffnen), dann `npx eas-cli build -p ios --profile preview`
   einmal **interaktiv** ausführen, damit EAS Zertifikat und Provisioning-Profil anlegt. Spätere Builds
   laufen ohne Rückfragen. Alternative ohne Geräteliste: TestFlight (interne Tester) – das ist ein Upload zu
   App Store Connect, aber keine Veröffentlichung.

## 3. Testversion bauen und installieren

- **Expo-Dashboard:** Workflows → „Testversion bauen“ (`.eas/workflows/build-preview.yml`) → _Run_.
- **Kommandozeile:** `npx eas-cli build --platform android --profile preview`
- Nach etwa 15–30 Minuten (kostenloser Tarif: Warteschlange) erscheint auf der Build-Seite ein
  Installationslink mit QR-Code. Auf Android die Installation aus dieser Quelle erlauben.

Die App heißt auf dem Gerät **„Terminlücke Test“** (`APP_VARIANT=preview`) und hat dieselbe Paket-ID wie die
spätere Store-Version – beide lassen sich daher nicht gleichzeitig installieren.

## 4. Änderungen ohne Neuinstallation (EAS Update)

Für reine JS-Änderungen (Texte, Layout, Logik – keine neuen nativen Module):
Expo-Dashboard → Workflows → „Testversion aktualisieren“ (`.eas/workflows/update-preview.yml`)
oder `npx eas-cli update --channel preview --message "…"`.
Die App lädt das Update beim nächsten Start im Hintergrund und nutzt es ab dem darauffolgenden Start
(der Kaltstart wartet nicht auf das Netz). Auf der Diagnose-Seite gibt es „Nach Update suchen“.
Neue native Module oder eine neue App-Version (`version` in `app.config.ts`) brauchen einen neuen Build.

## 5. Diagnose-Seite

Nur in Testversionen (Kanal `development`/`preview`/`preview-backend` oder `EXPO_PUBLIC_DIAGNOSTICS=1`):

- Version, Build-Nummer, Update-Kanal und -ID, Gerät, Datenmodus, Kartenserver, Push-Projekt, Fehlerberichte
- **Startzeit:** letzter Kaltstart und Median der letzten 20 Messungen (JS-Start bis bedienbar)
- **Bedienungshilfen:** Screenreader, Schriftgröße, Bewegung reduzieren, Fettschrift (iOS)
- „Bericht teilen“ – Text für Rückmeldungen, ohne personenbezogene Daten

## 6. Startzeit messen

- **In der App:** App ganz schließen, neu öffnen, Profil → Testversion & Diagnose. Mehrmals wiederholen.
- **Android, vollständig (inkl. Prozessstart und Startbild):** Gerät per USB, dann
  `scripts/measure-startup.sh 10` – gibt je Lauf „erstes Bild“, „bedienbar“ und den JS-Anteil aus, am Ende
  die Mediane. Ziel: bedienbar < 2 s auf einem Mittelklasse-Gerät.
- **iOS:** Xcode → Instruments → „App Launch“ mit dem `preview`-Build; dazu den Wert der Diagnose-Seite.

Ergebnisse in `docs/performance.md` §4 eintragen.

## 7. Ersatzweg ohne EAS

GitHub → Actions → „Android-Test-APK (ohne EAS)“ → _Run workflow_. Nach etwa 30–40 Minuten liegt die APK
als Artefakt am Workflow-Lauf (ZIP herunterladen, entpacken, auf dem Gerät öffnen). Diese APK ist mit dem
Debug-Schlüssel signiert und bekommt keine EAS Updates; vor einer EAS-Version deinstallieren.

## 8. Mit Server testen (später)

Profil `preview-backend` (`EXPO_PUBLIC_DATA_MODE=supabase`). Vorher in EAS unter _Environment variables_
für die Umgebung `preview` setzen: `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY`
(öffentliche Werte, Sichtbarkeit „Plain text“). Niemals den Service-Role-Key.
