# Supabase in Frankfurt einrichten

> Stand: 06.10.2026. Ziel: ein Supabase-Projekt in **eu-central-1 (Frankfurt)**, eingerichtet über
> den GitHub-Workflow „Supabase bereitstellen (Frankfurt)“ (`.github/workflows/supabase-deploy.yml`).
> Der Workflow ist wiederholbar und bricht ab, wenn das Projekt nicht in Frankfurt liegt.

## Stand des Projekts

| Punkt            | Stand                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Projekt          | `mednow`, Ref `gimynoopnheaapqihsdb`, Region eu-central-1, Organisation „Terminlücke“ (Free-Tarif)                              |
| Migrationen      | 0100–1000 eingespielt (Workflow), Historie passt zu den Dateinamen                                                              |
| Demo-Daten       | 60 Praxen rund um Fulda, Slots für 14 Tage, täglich weitergerollt (`mednow-demo-roll`)                                          |
| Vault-Secrets    | angelegt (Werte nur in der Datenbank erzeugt)                                                                                   |
| pg_cron / pg_net | aktiv, 5 Jobs                                                                                                                   |
| Auth             | anonyme Anmeldung, E-Mail-Codes (6 Stellen), MFA, Rate-Limits übertragen – **ohne eigene E-Mail-Vorlagen** (siehe unten)        |
| Edge Functions   | 7 aktiv (`account`, `book_slot`, `cancel_appointment`, `hold_slot`, `reschedule_appointment`, `send_notifications`, `waitlist`) |
| Rauchtest        | Suche mit dem öffentlichen App-Schlüssel (Rolle `anon`) liefert 60 Praxen                                                       |
| App              | `eas.json`: `preview-backend` und `production` zeigen auf dieses Projekt (Publishable Key)                                      |
| Offen            | eigener EU-SMTP-Anbieter (E-Mail-Codes an beliebige Adressen), Push-Zugänge (`docs/push-setup.md`)                              |

> **E-Mail-Codes:** Ohne eigenen SMTP-Anbieter verschickt Supabase nur an Adressen des eigenen Teams und erlaubt
> keine eigenen Vorlagen. Nach dem Einrichten (z. B. ein EU-Anbieter mit AV-Vertrag) den Workflow mit
> „E-Mail-Vorlagen übertragen“ starten.

## 1. Projekt anlegen (einmalig, erledigt)

**Weg A – Dashboard:** supabase.com → _New project_ → Name `mednow`, **Region: Central EU (Frankfurt)**,
sicheres Datenbank-Passwort vergeben und im Passwort-Manager speichern. Für den Echtbetrieb mit
Gesundheitsdaten: kostenpflichtiger Tarif (Backups/PITR, kein Pausieren), AV-Vertrag (DPA) im Dashboard
abschließen.

**Weg B – über Claude:** Supabase-Connector in claude.ai verbinden; dann kann Claude das Projekt in
`eu-central-1` anlegen (die Kosten werden vorher angezeigt und müssen bestätigt werden), Migrationen
einspielen und den Zustand prüfen. Das Datenbank-Passwort vergibst du trotzdem selbst.

## 2. Zugänge in GitHub hinterlegen

GitHub → Repository → _Settings → Secrets and variables → Actions_:

| Art      | Name                    | Wert                                                                                                             |
| -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Secret   | `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens → _Generate new token_                                                     |
| Secret   | `SUPABASE_DB_PASSWORD`  | Projekt angelegt über den Connector → einmal neu setzen: Project Settings → Database → _Reset database password_ |
| Secret   | `EXPO_ACCESS_TOKEN`     | optional, für Push (`docs/push-setup.md`)                                                                        |
| Variable | `SUPABASE_PROJECT_REF`  | `gimynoopnheaapqihsdb`                                                                                           |

Kein Service-Role-Key – weder in GitHub noch in der App noch im Repository.

## 3. Bereitstellen

GitHub → _Actions_ → „Supabase bereitstellen (Frankfurt)“ → _Run workflow_.
Beim **ersten Lauf** „Demo-Daten einspielen“ anhaken. Der Workflow

1. prüft die Region (nur `eu-central-1`),
2. überträgt die Auth-Konfiguration (`supabase/config.toml`: anonyme Anmeldung, E-Mail-Codes,
   Zwei-Faktor-Pflicht fürs Dashboard, E-Mail-Vorlagen, Rate-Limits),
3. spielt alle Migrationen ein (mit `pg_cron`/`pg_net` werden die Hintergrund-Jobs angelegt),
4. legt die Vault-Secrets an, **nur wenn sie fehlen**: `mednow_field_key` (Feldverschlüsselung –
   wird nie ersetzt, sonst wären verschlüsselte Daten unlesbar), `mednow_worker_secret`,
   `mednow_functions_url`,
5. setzt `WORKER_SECRET` (= Vault-Wert) und optional `EXPO_ACCESS_TOKEN` für die Edge Functions,
6. stellt alle Edge Functions bereit.

Danach im Supabase-Dashboard prüfen: _Database → Extensions_ (`pg_cron`, `pg_net` an),
_Integrations → Cron_ (5 Jobs), _Edge Functions_ (7 Funktionen).

## 4. App und Dashboard anbinden

- **Testversion mit Server:** expo.dev → Projekt → _Environment variables_ → Umgebung `preview`:
  `EXPO_PUBLIC_SUPABASE_URL` = `https://<ref>.supabase.co`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` =
  _Publishable key_ (Project Settings → API Keys; Sichtbarkeit „Plain text“ – öffentlich by design,
  geschützt durch RLS). Dann Profil `preview-backend` bauen (`docs/test-builds.md` §8).
- **Praxis-Dashboard:** dieselben Werte als `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (`dashboard/README.md`).
- Praxis-Konten anlegen und Praxen zuordnen: `dashboard/README.md`, Abschnitt „Praxis-Zugang einrichten (Admin)“.

## 5. Vor dem Echtbetrieb (siehe `TODO.md`)

- Eigener SMTP-Anbieter mit EU-Servern (Supabase-Standard-SMTP ist auf wenige Mails/Stunde begrenzt).
- Backups/Point-in-Time-Recovery, Log-Aufbewahrung, Auth-Rate-Limits prüfen.
- Demo-Daten (`is_demo`) entfernen oder in einem getrennten Projekt betreiben.
- „Site URL“/Redirects für das Dashboard ergänzen, sobald dessen Domain feststeht.
