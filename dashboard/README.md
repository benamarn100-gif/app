# Terminlücke Praxis-Dashboard

Web-App für Praxen: freie Termine pflegen, Sprechzeiten-Vorlagen anwenden, Buchungen sehen und absagen.
Neue oder geänderte Termine erscheinen sofort in der App (Realtime) und werden – falls jemand auf der
Warteliste steht – direkt angeboten.

![Wochenplan](../docs/screenshots/dashboard-week.png)

## Starten

Voraussetzung: Node.js 22.12+. Das Dashboard nutzt Domain-Code, Texte und Design-Tokens der App
(`../src`), deshalb zuerst die App-Abhängigkeiten installieren:

```bash
npm ci                 # im Hauptverzeichnis
cd dashboard
npm ci
npm run dev            # http://localhost:5173
```

Ohne Zugangsdaten startet der **Demo-Modus**: eine fiktive Praxis aus dem Seed-Generator der App
(dieselben Praxen wie in der Demo-App) mit fiktiven Buchungen („Mustermann“, „Beispiel“, Telefonnummern
aus dem Film-/TV-Bereich 069 90009). Änderungen bleiben im Browser-Tab. Nach ca. 25 Sekunden „bucht“ eine
fiktive Person über die App einen Termin – so sieht man, wie Buchungen live ankommen.

## Mit Supabase

`.env.example` nach `.env.local` kopieren:

```
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon/publishable key>
```

Niemals den Service-Role-Key eintragen – das Dashboard verweigert den Start mit einem geheimen Schlüssel.

### Praxis-Zugang einrichten (Admin)

1. Supabase Studio → **Authentication → Users → Add user → Create new user**: E-Mail der Praxis,
   „Auto Confirm User“ aktivieren (das Passwort wird nicht genutzt; Anmeldung per E-Mail-Code).
2. SQL-Editor:
   ```sql
   select app.add_practice_member('<practice-id>', 'praxis@example.org', 'owner');  -- oder 'staff'
   ```
   Entfernen: `select app.remove_practice_member('<practice-id>', 'praxis@example.org');`
3. Erste Anmeldung: E-Mail-Code, danach Einrichtung der Zwei-Faktor-Anmeldung (TOTP, z. B. mit einer
   Authenticator-App). Ohne zweiten Faktor (aal2) liefert die Datenbank keine Daten.

## Sicherheit und Datenschutz

| Maßnahme                          | Umsetzung                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zugriff nur für Praxis-Mitglieder | `practice_members` + Prüfung in jeder RPC (`app.require_practice_member`)                                                                         |
| Zwei-Faktor-Pflicht               | JWT-Claim `aal = aal2`, sonst Fehler `mfa_required`                                                                                               |
| Keine direkten Tabellenrechte     | alle Lese-/Schreibzugriffe über security-definer-RPCs `dashboard_*`                                                                               |
| Patientendaten minimal            | Name, Telefon, Versicherung nur für bestätigte Termine; nach Absage entfernt; Familienmitglieder nur mit Altersgruppe                             |
| Zugriffsprotokoll                 | jeder Abruf von Buchungen und jede Änderung in `app.practice_audit_log` (12 Monate)                                                               |
| Sitzung                           | nur `sessionStorage` (endet mit dem Tab), Abmeldung nach 30 Minuten ohne Aktivität, Patientendaten werden beim Abmelden aus dem Speicher entfernt |
| Browser                           | strenge Content-Security-Policy im Build, keine externen Schriften/Skripte, `noindex`, kein Referrer                                              |
| Push an Patient:innen             | bei Absage nur „Die Praxis hat einen Termin abgesagt“ – ohne Praxis, Arzt, Uhrzeit                                                                |

## Befehle

| Befehl            | Zweck                                                                           |
| ----------------- | ------------------------------------------------------------------------------- |
| `npm run dev`     | Entwicklung                                                                     |
| `npm run build`   | Typprüfung + Produktions-Build nach `dist/`                                     |
| `npm run preview` | Build lokal ansehen (mit CSP)                                                   |
| `npm test`        | Vitest: Vorlagen/Zeitzone, Demo-Regeln, Theme, Texte, Abläufe inkl. axe-Prüfung |
| `npm run lint`    | ESLint (keine Texte im JSX, keine Farbwerte)                                    |
| `npm run check`   | alles zusammen                                                                  |

Datenbank-Tests für die Dashboard-Funktionen: `npm run db:test` im Hauptverzeichnis
(`supabase/tests/database/06_dashboard.test.sql`).

## Hosting

`dist/` ist eine statische Seite. Vor Launch bei einem EU-Hoster mit AV-Vertrag betreiben (z. B. eigener
Server in Deutschland oder EU-Region eines CDN) und dort zusätzlich als HTTP-Header setzen:
`Content-Security-Policy` (wie im Build), `Strict-Transport-Security`, `X-Frame-Options: DENY`,
`Permissions-Policy: camera=(), microphone=(), geolocation=()`. Siehe `TODO.md`.
