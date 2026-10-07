# In-App-Käufe einrichten (MedNow Plus / Familie)

> Stand: 10/2026. Technik: RevenueCat (`react-native-purchases`) über App Store und Google Play.
> Ohne die Schritte unten zeigt die App die Bezahlseite mit dem Hinweis „Käufe noch nicht
> möglich“ – alle kostenlosen Funktionen laufen normal. Im Demo-Modus werden Käufe nur
> simuliert („Es wird nichts berechnet“).

## Stufen und Produkte

| Stufe   | Produkt-ID             | Art                                          | Preis (Vorschlag) | Test    |
| ------- | ---------------------- | -------------------------------------------- | ----------------- | ------- |
| Plus    | `mednow_plus_pass_30d` | iOS: nicht verlängerndes Abo · Play: Prepaid | 4,99 € einmalig   | keiner  |
| Plus    | `mednow_plus_yearly`   | Jahresabo                                    | 29,99 € pro Jahr  | 14 Tage |
| Familie | `mednow_family_yearly` | Jahresabo                                    | 44,99 € pro Jahr  | 14 Tage |

Grenzen je Stufe: `src/domain/plans.ts` (App) und Migration `20261006001300_plans.sql` (Server) –
beide müssen gleich bleiben.

|                            | Kostenlos   | Plus        | Familie     |
| -------------------------- | ----------- | ----------- | ----------- |
| Termin-Alarme gleichzeitig | 1           | 10          | 10          |
| Alarm-Laufzeit             | bis 14 Tage | bis 60 Tage | bis 60 Tage |
| Profile (inkl. „Ich“)      | 2           | 2           | 5           |
| Kalender-Sync, Favoriten   | –           | ✓           | ✓           |
| Vorsorge-Erinnerungen      | Übersicht   | für dich    | für alle    |

**Fairness:** Keine Stufe ändert die Reihenfolge auf Termin-Alarmen (FIFO nach Eintragung,
10 Minuten Reservierung für alle) – geprüft in `supabase/tests/database/07_plans.test.sql`.

## Schritte (einmalig)

1. **App Store Connect:** die drei Produkte anlegen (Jahresabos in einer Abo-Gruppe, 14-Tage-Test
   als Einführungsangebot), Small Business Program beantragen (15 % Provision), Steuer- und
   Bankdaten hinterlegen.
2. **Google Play Console:** Pass als Prepaid-Plan, Jahresabos mit 14-Tage-Test.
3. **RevenueCat:** Projekt anlegen, beide Stores verbinden, Produkte importieren,
   **Entitlements `plus` und `family`** anlegen (Familie-Produkt schaltet beide frei).
   AV-Vertrag (DPA) abschließen. Keine Integrationen für Werbung/Attribution aktivieren.
4. **Öffentliche SDK-Schlüssel** in expo.dev → Projekt → Environment variables (Umgebungen
   `preview` und `production`): `EXPO_PUBLIC_REVENUECAT_IOS_KEY`,
   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (öffentlich by design).
5. **Webhook:** RevenueCat → Integrations → Webhooks → URL
   `https://gimynoopnheaapqihsdb.supabase.co/functions/v1/billing_webhook`, Authorization-Header
   `Bearer <zufälliges Geheimnis>`. Dasselbe Geheimnis in GitHub als Secret
   `REVENUECAT_WEBHOOK_SECRET`, dann den Workflow „Supabase bereitstellen“ starten.
6. **Löschen:** geheimen REST-Schlüssel (RevenueCat → API keys, v1 secret) in GitHub als Secret
   `REVENUECAT_SECRET_API_KEY` – dann löscht „Konto löschen“ auch den Kundendatensatz dort.
7. **Neuer nativer Build** (das Kauf-SDK ist ein natives Modul): Profil `preview` bzw.
   `production`.

## Datenschutz

- RevenueCat bekommt nur die pseudonyme Supabase-Nutzer-ID – keine E-Mail, keine Attribute.
- Der Server speichert nur Stufe, Produkt-ID und Ablaufdatum (`app.entitlements`), keine Belege.
- Konto löschen: Stufe wird mit dem Konto gelöscht (Fremdschlüssel), RevenueCat-Datensatz per API.

## Recht (vor dem Start prüfen lassen)

- Abo-Bedingungen in die Nutzungsbedingungen, Widerrufsrecht bei digitalen Inhalten.
- Preisangaben mit Gesamtpreis (so umgesetzt), Kündigungsweg nennen (so umgesetzt).
- Kündigungsknopf nach § 312k BGB erst nötig bei Käufen außerhalb der Stores.

## Bewusst nicht umgesetzt

- **Bezahlter Vorrang / schnellere Benachrichtigung:** abgelehnt (Fairness, Rechtsrisiko).
- **„Werbefrei“ als Vorteil:** MedNow zeigt in keiner Stufe Werbung.
- **Gemeinsamer Haushalt (2 Konten, Einladung):** kommt mit dem Familien-Ausbau.
- **Zeitfenster („vor 9 Uhr“, „samstags“) und „Früher dran“:** nächster Ausbauschritt.
