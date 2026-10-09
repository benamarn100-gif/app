# Webseite und Praxis-Dashboard online stellen

> Stand: 08.10.2026. Die Stores verlangen eine öffentliche Datenschutz-URL; Pilotpraxen brauchen das
> Praxis-Dashboard im Browser. Beides liegt als statische Dateien auf einem Webspace in der EU. Die Daten
> selbst bleiben in Supabase (Frankfurt) – der Webspace liefert nur die Seiten aus.

## 1. Webspace mit Domain

Ein Paket bei einem deutschen Webhoster mit: **eigener Domain**, **SFTP- oder FTPS-Zugang**,
**.htaccess (Apache)**, **kostenlosem SSL-Zertifikat**, **DNS-Verwaltung** (für die Absender-Domain der
E-Mails) und **AV-Vertrag**. Geeignet sind z. B. netcup (Nürnberg) oder IONOS (Montabaur); vor dem Kauf auf
der Tarifseite prüfen, dass alle Punkte im gewählten Tarif enthalten sind. Das deckt auch die Absenderadresse für E-Mails
(`docs/email-setup.md`) und ein Postfach für Support ab. Domain vorher auf Markenrechte prüfen
(`TODO.md`, Markenrecherche „MedNow“).

1. Paket buchen, Domain registrieren, **SSL** für die Domain einschalten.
2. **SFTP-Zugang** (oder FTPS) anlegen bzw. ablesen: Server, Benutzer, Passwort und den Ordner, in dem die
   Domain liegt (Document Root).
3. **AV-Vertrag** im Kundenkonto abschließen und ablegen.

## 2. In GitHub hinterlegen

Repository → **Settings → Secrets and variables → Actions**:

| Art      | Name              | Wert                                                         |
| -------- | ----------------- | ------------------------------------------------------------ |
| Secret   | `UPLOAD_HOST`     | Server des Hosters (ohne `sftp://`)                          |
| Secret   | `UPLOAD_USER`     | Benutzer                                                     |
| Secret   | `UPLOAD_PASSWORD` | Passwort                                                     |
| Variable | `UPLOAD_PROTOCOL` | `sftp` (Standard) oder `ftps`                                |
| Variable | `UPLOAD_DIR`      | Ordner der Domain, z. B. `/` oder `/mednow`                  |
| Variable | `SUPPORT_EMAIL`   | Kontaktadresse für die Startseite                            |
| Variable | `DASHBOARD_URL`   | `https://<deine-domain>/praxis/` (für „Pilotpraxis anlegen“) |

## 3. Bereitstellen

**Actions → „Webseite und Praxis-Dashboard bereitstellen“ → Run workflow.** Danach prüfen:

- `https://<deine-domain>/` – Startseite mit Notfallhinweis und Links
- `https://<deine-domain>/datenschutz/` – diese URL kommt in beide Stores
- `https://<deine-domain>/praxis/` – Anmeldeseite des Praxis-Dashboards

Solange die Rechtstexte Platzhalter enthalten, sind diese gelb markiert und der Entwurfshinweis ist
sichtbar. Für einen Probelauf ohne Hochladen: Häkchen „Auf den Webspace hochladen“ abwählen, Ergebnis als
Artefakt „webseite“ herunterladen.

## Sicherheit

Die Workflow-Dateien legen `.htaccess` mit HTTPS-Weiterleitung, HSTS, Content-Security-Policy,
`X-Frame-Options: DENY` und `noindex` für das Dashboard an (`scripts/build-website.ts`). Bei einem
Fehler 500 nach dem Hochladen unterstützt der Hoster eine Direktive nicht – dann die betreffende Zeile in
`scripts/build-website.ts` anpassen.
