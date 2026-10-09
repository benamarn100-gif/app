# Offene Punkte

> Stand: 06.10.2026. Alles hier ist bewusst **nicht** erledigt – entweder weil es Zugänge, Verträge oder
> echte Geräte braucht, oder weil eine Produktentscheidung fehlt. Reihenfolge innerhalb der Abschnitte = Priorität.

## 1. Vor dem Launch zwingend

### Recht und Organisation (siehe `docs/legal-checklist.md`)

- [ ] Datenschutz-Folgenabschätzung, Verzeichnis der Verarbeitungstätigkeiten, Datenschutzbeauftragte/r.
- [ ] Impressum, Datenschutzerklärung, Nutzungsbedingungen, Barrierefreiheitserklärung (Platzhalter `legal.*` in `src/i18n/locales`, markiert „vor Launch anwaltlich prüfen“).
- [ ] Einwilligungstext Gesundheitsdaten juristisch prüfen; bei Änderung `HEALTH_CONSENT_VERSION` erhöhen.
- [ ] AV-Verträge: Supabase, Expo, Sentry (oder GlitchTip selbst hosten), E-Mail-Versand, Hosting Dashboard, Kartenkacheln.
- [ ] Vereinbarung mit Praxen (Art. 26/28 DSGVO, Pflegepflichten, Zwei-Faktor-Pflicht, Absagen).
- [ ] Markenrecherche „Terminlücke“ (DPMA/EUIPO/Stores); Name nur in `src/config/brand.ts`, `supabase/templates/*.html`, Push-Titel in `supabase/functions/_shared/push.ts`.

### Backend (Supabase, Region eu-central-1)

- [x] Projekt in Frankfurt angelegt (`gimynoopnheaapqihsdb`), Migrationen 0100–0800 und Vault-Secrets eingespielt und geprüft.
- [ ] GitHub-Secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` und Variable `SUPABASE_PROJECT_REF` setzen, dann Workflow „Supabase bereitstellen (Frankfurt)“ mit Demo-Daten ausführen (0900, Seed, `config push`, Edge Functions – `docs/supabase-setup.md`).
- [ ] Danach prüfen: Erweiterungen `pg_cron`/`pg_net` aktiv, 5 Cron-Jobs angelegt, 7 Edge Functions bereit.
- [ ] Eigenen SMTP-Anbieter mit Sitz/Servern in der EU hinterlegen (Supabase-Standard-SMTP ist nur für Tests).
- [ ] Point-in-Time-Recovery/Backups, Auth-Rate-Limits und Log-Aufbewahrung im Projekt prüfen.
- [ ] Demo-Daten (`is_demo`) vor dem Livegang entfernen oder klar getrennt betreiben.

### App-Auslieferung (Expo/EAS) – erst nach Abnahme

- [x] Expo-Projekt verknüpft (`extra.eas.projectId`), Testprofile und EAS Update eingerichtet (`docs/test-builds.md`).
- [ ] Expo-Projekt auf expo.dev mit dem GitHub-Repository verbinden (für Builds aus dem Repository).
- [ ] Bundle-ID/Package (`brand.ts`) final, bevor die erste Store-Version entsteht.
- [ ] Push: `google-services.json` als EAS-Datei-Variable, FCM-V1-Dienstkonto und APNs-Key in EAS, `EXPO_ACCESS_TOKEN` für die Edge Function; Zustellung und Sperrbildschirm-Texte auf Geräten prüfen (`docs/push-setup.md`).
- [ ] Kartenspeicher in der EU anlegen, Workflow „Kartenkacheln bereitstellen (EU)“ ausführen, `EXPO_PUBLIC_MAP_STYLE_URL(_DARK)` setzen; OSM-Attribution sichtbar lassen (`docs/map-tiles.md`).
- [ ] Sentry: Organisation in der EU-Region, DSN als `EXPO_PUBLIC_SENTRY_DSN`, „Prevent Storing of IP Addresses“ aktivieren, `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` als EAS-Secrets für Quellkarten (Metro-Konfiguration `getSentryExpoConfig` ergänzen).
- [ ] Store-Angaben: Apple App Privacy, Google Data Safety, Gesundheits-App-Richtlinien, Screenshots, Altersfreigabe.

### Praxis-Dashboard

- [ ] Statisches Hosting in der EU mit Headern: CSP (wie im Build), HSTS, `X-Frame-Options: DENY`, `Permissions-Policy`.
- [ ] Prozess „Authenticator verloren“: Identität prüfen, Faktor im Supabase-Dashboard entfernen, neu einrichten lassen.
- [ ] Ablauf mit echter Praxis durchspielen (Anmeldung, 2FA, Vorlagen, Absage → Push in der App).

## 2. Qualität auf echten Geräten

- [ ] Barrierefreiheit: VoiceOver, TalkBack, Schaltersteuerung, 200 % Schrift, Querformat (Prüfplan `docs/accessibility-audit.md` §4) – mit Betroffenen.
- [ ] Performance: Kaltstart < 2 s, 60 fps, Speicher (Messplan `docs/performance.md` §4; Messung: `scripts/measure-startup.sh` und Diagnose-Seite der Testversion).
- [ ] Maestro-Abläufe (`.maestro/`) regelmäßig ausführen, z. B. EAS Workflows oder macOS-Runner mit Simulator in CI.
- [ ] Lasttest `search_availability` und `book_slot` mit realistischer Datenmenge (z. B. 5 000 Praxen, 1 Mio. Slots).

## 3. Produktentscheidungen und Ausbau

- [ ] **Reale Praxisdaten:** OSM-Import (ODbL, `docs/data-sources.md`) – ohne Dashboard-Anbindung immer Status „Unbekannt“; Import-Skript fehlt noch.
- [ ] **Praxis-Verwaltung:** Praxen und Ärztinnen/Ärzte anlegen/bearbeiten (derzeit per SQL), Team-Einladungen durch die Praxisleitung (braucht Edge Function mit Admin-API).
- [ ] **Familienmitglieder:** Soll die Praxis den Namen des Kindes sehen? Derzeit nur Altersgruppe + Kontaktperson (D-43).
- [ ] **Bewertungen:** Es gibt nur Demo-Durchschnittswerte; echte Bewertungen erst nach Klärung HWG/UWG und Moderationskonzept.
- [ ] **116117-Terminservice:** nur Machbarkeitsstudie (`docs/116117-spike.md`).
- [ ] **Nutzungsstatistik:** keine; falls gewünscht nur Opt-in und EU-gehostet (Einwilligungstyp `analytics` ist vorbereitet).
- [ ] **Kalender:** Migration von `expo-calendar/legacy` auf die neue API, sobald Android einen Standardkalender unterstützt (D-37).
- [ ] **Rate-Limits:** zusätzlich zu den DB-Grenzen (z. B. 10 aktive Wartelisten) Begrenzung von Buchungsversuchen je Konto/IP in den Edge Functions.
- [ ] **E-Mail-Vorlagen:** Darstellung in gängigen Mail-Programmen prüfen; Markenname bei Umbenennung anpassen.
