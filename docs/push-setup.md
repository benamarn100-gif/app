# Push-Mitteilungen einrichten (iOS und Android)

> Stand: 06.10.2026. Push wird nur für die **Warteliste** genutzt (Angebot frei geworden, Absage durch die
> Praxis). Terminerinnerungen sind lokale Mitteilungen auf dem Gerät und brauchen keinen Push-Zugang.
> Sperrbildschirm-Texte enthalten keine Gesundheitsdaten (`supabase/functions/_shared/push.ts`).

## 1. Wie es zusammenhängt

```
App ──(Expo-Push-Token, nur mit Einwilligung)──▶ Supabase (Edge Function account → public.push_tokens)
Datenbank-Ereignis ─▶ Outbox ─▶ Edge Function send_notifications ─▶ Expo Push Service ─▶ APNs / FCM ─▶ Gerät
```

Die App braucht dafür nur die Expo-Projekt-ID (ist in `app.config.ts` hinterlegt). Die eigentlichen
Zugänge zu Apple (APNs) und Google (FCM) liegen bei EAS, nicht im Repository.

## 2. Android (Firebase Cloud Messaging, API V1)

1. console.firebase.google.com → Projekt anlegen (Google Analytics **aus**), Standort der Daten: EU.
2. _Projekt­einstellungen → Allgemein → App hinzufügen → Android_, Paketname **`de.terminluecke.app`**.
   `google-services.json` herunterladen. Die Datei enthält keine Geheimnisse im engeren Sinn, kommt aber
   trotzdem nicht ins Repository.
3. expo.dev → Projekt → _Environment variables_ → _Add variable_: Name **`GOOGLE_SERVICES_JSON`**,
   Typ **Datei**, Datei hochladen, Umgebungen `preview` und `production`, Sichtbarkeit „Secret“.
   `app.config.ts` übernimmt den Pfad automatisch als `android.googleServicesFile`.
4. Firebase → _Projekteinstellungen → Dienstkonten_ → _Neuen privaten Schlüssel generieren_ (JSON).
5. expo.dev → Projekt → _Credentials → Android → de.terminluecke.app → FCM V1 service account key_ → JSON hochladen.
   (Alternativ: `npx eas-cli credentials -p android` → „Google Service Account“ → „Push Notifications (FCM V1)“.)
6. Neuen Android-Build erstellen (die Datei wird beim Build eingebunden).

## 3. iOS (Apple Push Notification service)

Voraussetzung: Apple Developer Program.

1. Beim ersten iOS-Build (`npx eas-cli build -p ios --profile preview`, interaktiv) fragt EAS, ob es einen
   Push-Schlüssel anlegen soll → **Ja**. EAS erzeugt den APNs-Schlüssel (.p8) und speichert ihn.
2. Oder manuell: developer.apple.com → _Keys_ → neuen Schlüssel mit „Apple Push Notifications service“
   → .p8 herunterladen → expo.dev → _Credentials → iOS → Push Key_ hochladen.
3. Die App-ID braucht die Fähigkeit „Push Notifications“ – EAS setzt sie beim Build automatisch.

## 4. Server: Expo-Zugang für die Edge Function

1. expo.dev → _Account settings → Access tokens_ → Token anlegen (Name z. B. `mednow-push`).
2. Empfohlen: expo.dev → Projekt → _Settings_ → **„Enhanced security for push notifications“** einschalten –
   dann nimmt der Push-Dienst nur Anfragen mit diesem Token an.
3. Token als GitHub-Secret **`EXPO_ACCESS_TOKEN`** hinterlegen und den Workflow
   „Supabase bereitstellen (Frankfurt)“ erneut ausführen (setzt das Edge-Function-Secret),
   oder direkt: `npx supabase secrets set EXPO_ACCESS_TOKEN=…`.

## 5. Prüfen

1. Testversion mit Server (`preview-backend`) auf echtem Gerät installieren (Simulatoren erhalten keine Pushes).
2. Praxis → „Sag mir Bescheid“ → Mitteilungen erlauben (die Frage kommt erst hier, nicht beim Start).
3. Im Praxis-Dashboard für diese Praxis einen passenden Termin freigeben → innerhalb weniger Sekunden
   „Ein Termin ist frei geworden“; Tippen öffnet das Angebot.
4. Sperrbildschirm: keine Fachrichtung, kein Anlass, kein Name.
5. Absage im Dashboard → Mitteilung „Termin abgesagt“ ohne Details.

Fehlersuche: Supabase → _Edge Functions → send_notifications → Logs_; Tabelle `app.notification_outbox`
(Spalten `attempts`, `last_error`, `sent_at`; nach 5 Versuchen Schluss). Meldet der Push-Dienst
`DeviceNotRegistered`, löscht die Funktion das Token.

## 6. Datenschutz

Expo (Push-Dienst) und Google/Apple sind Auftragsverarbeiter bzw. Empfänger – AV-Vertrag mit Expo,
Hinweis in der Datenschutzerklärung, Einwilligung vor dem ersten Push (ist umgesetzt, Widerruf im
Datenschutz-Center). Siehe `docs/legal-checklist.md`.
