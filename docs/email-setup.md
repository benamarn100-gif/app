# E-Mail-Versand einrichten (Anmeldecodes)

> Stand: 08.10.2026. Ohne eigenen Anbieter verschickt Supabase Codes **nur an Adressen des eigenen Teams** –
> Pilotpraxen und Testerinnen könnten sich nicht anmelden. Empfehlung: **Brevo** (Brevo SAS, Paris; Server in
> der EU; kostenlos bis 300 E-Mails pro Tag; AV-Vertrag in den Kontoeinstellungen). Jeder andere
> EU-Anbieter mit SMTP geht genauso.

Voraussetzung: eine eigene Domain mit Zugriff auf die DNS-Einstellungen (siehe `docs/website-setup.md`).

## 1. Brevo-Konto und Domain

1. brevo.com → kostenloses Konto anlegen (Firmenangaben wie im Impressum).
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain**: deine Domain eintragen.
3. Brevo zeigt 3–4 DNS-Einträge (Bestätigungscode, DKIM, DMARC). Beim Domain-Anbieter unter „DNS“ genau so
   anlegen, dann bei Brevo **Verify** – kann bis zu einigen Stunden dauern.
4. **Senders → Add a sender**: Absender `no-reply@<deine-domain>`, Name „Terminlücke“.
5. **AV-Vertrag:** Kontoeinstellungen → Datenschutz/DPA herunterladen bzw. bestätigen und ablegen.

## 2. SMTP-Zugang

1. **SMTP & API → SMTP → Generate a new SMTP key** (Name z. B. `supabase`). Der Schlüssel wird nur einmal
   angezeigt – direkt in GitHub eintragen, nirgends sonst speichern.
2. Auf derselben Seite stehen Server (`smtp-relay.brevo.com`), Port (`587`) und **Login**.

## 3. In GitHub hinterlegen

Repository → **Settings → Secrets and variables → Actions**:

| Art      | Name                | Wert                         |
| -------- | ------------------- | ---------------------------- |
| Secret   | `SMTP_HOST`         | `smtp-relay.brevo.com`       |
| Secret   | `SMTP_PORT`         | `587`                        |
| Secret   | `SMTP_USER`         | Login aus Schritt 2          |
| Secret   | `SMTP_PASS`         | SMTP-Schlüssel aus Schritt 2 |
| Variable | `SMTP_SENDER_EMAIL` | `no-reply@<deine-domain>`    |

## 4. Übertragen und testen

1. **Actions → „Supabase bereitstellen (Frankfurt)“ → Run workflow** (Auth-Konfiguration angehakt). Der
   Workflow trägt den Anbieter ein, überträgt die E-Mail-Vorlagen und erlaubt bis zu 30 Codes pro Stunde.
2. Test: Testversion mit Server (`preview-backend`) oder Praxis-Dashboard → mit einer beliebigen Adresse
   anmelden → Code muss innerhalb einer Minute ankommen (auch im Spam-Ordner nachsehen).
3. Kommt nichts an: Brevo → **Transactional → Logs**; Supabase → **Authentication → Logs**.
