# Pilotpraxis einrichten – Ablauf Schritt für Schritt

> Stand: 07.10.2026.
> Getrennt nach Rollen: **A** Betreiber (Admin), **B** Praxis, **C** gemeinsamer Probelauf, **D** Go-Live und
> Feedback. Grundlagen: `dashboard/README.md`, `supabase/migrations/20261006000800_practice_dashboard.sql`,
> `docs/push-setup.md`. Infoblatt für die Praxis: `docs/pilot/praxis-infoblatt.md`, Vereinbarung:
> `docs/pilot/praxis-vereinbarung.md`.

| Phase | Wer               | Ergebnis                                                        |
| ----- | ----------------- | --------------------------------------------------------------- |
| A     | Betreiber         | Praxis, Ärztinnen/Ärzte und Dashboard-Zugang sind angelegt      |
| B     | Praxis            | Zwei-Faktor eingerichtet, Vorlagen angelegt, erste Termine frei |
| C     | Praxis, Betreiber | Buchung, Absage, Termin-Alarm und Datenschutz geprüft           |
| D     | Praxis, Betreiber | Regelbetrieb, Feedbackgespräche nach 2 und 6 Wochen             |

---

## A. Betreiber (Admin)

### A1. Voraussetzungen – vor dem Anlegen erledigen

- [ ] **Eigener E-Mail-Anbieter** (SMTP, Server in der EU, AV-Vertrag) ist in Supabase hinterlegt und die
      E-Mail-Vorlagen sind übertragen (`docs/supabase-setup.md`). Ohne eigenen Anbieter verschickt Supabase
      Codes nur an Adressen des eigenen Teams – die Praxis bekäme **keinen Anmeldecode**.
- [ ] **Dashboard ist online** unter `https://[PLATZHALTER: Domain]/praxis/`:
  - Build mit `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL` und dem Publishable/Anon-Key
    (`dashboard/README.md`, Abschnitt „Mit Supabase“) – niemals den Service-Role-Key.
  - Unterpfad `/praxis/`: `dashboard/vite.config.ts` setzt kein `base`, der Build verweist auf `/assets/…`.
    Für den Unterpfad z. B. mit `npm run build -- --base=/praxis/` bauen, sonst laden Skripte und Styles nicht.
  - EU-Hoster mit AV-Vertrag und Sicherheits-Headern (`dashboard/README.md`, Abschnitt „Hosting“).
- [ ] **Vereinbarung mit der Praxis unterschrieben** (`docs/pilot/praxis-vereinbarung.md`, nach
      anwaltlicher Prüfung).
- [ ] Testversion der App mit Server (`preview-backend`, `docs/test-builds.md`) und Push-Zugänge
      (`docs/push-setup.md`) stehen für den Probelauf (Teil C) bereit.

### A2. Daten bei der Praxis abfragen

Genau diese Felder – sie entsprechen den Eingaben des GitHub-Workflows „Pilotpraxis anlegen“
(`.github/workflows/pilot-practice.yml`):

| Feld          | Pflicht | Was eintragen                                                                          | Beispiel                              |
| ------------- | ------- | -------------------------------------------------------------------------------------- | ------------------------------------- |
| `name`        | ja      | Praxisname, wie er öffentlich verwendet wird (2–120 Zeichen)                           | `Hausarztpraxis Am Beispielplatz`     |
| `address`     | ja      | Adresse als „Straße Nr, PLZ Ort“ (Komma vor der PLZ)                                   | `Beispielstraße 12, 36037 Fulda`      |
| `phone`       | empf.   | Öffentliche Praxisnummer – die App zeigt sie an (bei Status „Unbekannt“ als „Anrufen“) | `0661 000000`                         |
| `website`     | nein    | Website der Praxis                                                                     | `https://www.praxis-beispiel.de`      |
| `specialties` | ja      | Kurzbezeichner, kommagetrennt, Hauptfachrichtung zuerst (Liste unten)                  | `allgemeinmedizin,innere-medizin`     |
| `doctors`     | ja      | Namen der Ärztinnen/Ärzte, mit Semikolon getrennt                                      | `Dr. med. A. Beispiel; Dr. B. Muster` |
| `languages`   | nein    | Sprachcodes, kommagetrennt (Liste unten)                                               | `de,en,tr`                            |
| `owner_email` | ja      | E-Mail-Adresse für die Anmeldung im Dashboard                                          | `a.beispiel@praxis-beispiel.de`       |
| `coordinates` | nein    | „Breite, Länge“ mit Dezimalpunkt; leer = automatisch per OpenStreetMap ermittelt       | `50.5513, 9.6758`                     |

Hinweise zu den Feldern:

- **`doctors`:** Namen so, wie die Praxis sie öffentlich nennt (Praxisschild, Website). Nur Ärztinnen und Ärzte
  eintragen, deren Termine über Terminlücke angeboten werden – im Dashboard wird jeder Termin einer Person zugeordnet.
  In schmalen Spalten kürzt das Dashboard, z. B. „Dr. med. Anna Becker“ → „Dr. Becker“.
- **`owner_email`:** möglichst eine persönliche dienstliche Adresse, kein Sammelpostfach. Jeder Zugang gehört
  genau einer Person (Zwei-Faktor auf deren Gerät). Weitere Personen bekommen eigene Zugänge (A5).
- **`specialties`:** Die Praxisseite der App zeigt die erste Fachrichtung des Eintrags. Erlaubte Werte
  (`src/domain/seed/catalog.ts`, Feld `slug`):

| Kurzbezeichner               | Fachrichtung                   |
| ---------------------------- | ------------------------------ |
| `allgemeinmedizin`           | Allgemeinmedizin               |
| `innere-medizin`             | Innere Medizin                 |
| `kinder-jugendmedizin`       | Kinder- und Jugendmedizin      |
| `frauenheilkunde`            | Frauenheilkunde                |
| `hno`                        | Hals-Nasen-Ohren               |
| `augenheilkunde`             | Augenheilkunde                 |
| `dermatologie`               | Dermatologie                   |
| `orthopaedie`                | Orthopädie                     |
| `zahnmedizin`                | Zahnmedizin                    |
| `neurologie`                 | Neurologie                     |
| `urologie`                   | Urologie                       |
| `psychiatrie-psychotherapie` | Psychiatrie und Psychotherapie |

- **`languages`:** Die App zeigt diese Codes mit Namen an (`src/i18n/locales/de.json`, `languageName`):
  `de` Deutsch, `en` Englisch, `tr` Türkisch, `ru` Russisch, `ar` Arabisch, `pl` Polnisch, `fr` Französisch,
  `es` Spanisch, `uk` Ukrainisch. In der Regel mit `de` beginnen.
- **`coordinates`:** Bleibt das Feld leer, wird die Adresse per OpenStreetMap in Koordinaten umgerechnet. Das
  Ergebnis immer im Workflow-Protokoll prüfen (A4).

### A3. Workflow starten

1. GitHub → **Actions** → „Pilotpraxis anlegen“ → **Run workflow**.
2. Felder aus A2 eintragen (Groß-/Kleinschreibung und Trennzeichen beachten). Das Häkchen
   **„Nur prüfen (nichts anlegen)“** ist vorausgewählt → **Run workflow**. Der Probelauf prüft alle Angaben
   und zeigt die Kartenposition, legt aber nichts an.
3. Probelauf grün und Kartenlink stimmt? Workflow erneut starten, dieselben Angaben eintragen und das Häkchen
   **abwählen**. Bei Fehlern: Meldung im Protokoll lesen, Eingaben korrigieren, neu starten.

### A4. Ergebnis prüfen

- [ ] **Zusammenfassung** des Laufs zeigt **Praxis-ID** und **Kartenlink**. Praxis-ID notieren – sie wird
      für weitere Zugänge, Support und die Auswertung (Teil D) gebraucht.
- [ ] **Kartenlink öffnen:** Liegt der Punkt am Praxisgebäude? Bei automatisch ermittelten Koordinaten im
      Workflow-Protokoll prüfen, welche Adresse gefunden wurde. Falsch? Korrekte Koordinaten ermitteln und
      im Supabase-SQL-Editor setzen (Länge zuerst):

  ```sql
  update public.practices
     set geo = extensions.st_setsrid(extensions.st_makepoint(<länge>, <breite>), 4326)::extensions.geography
   where id = '<praxis-id>';
  ```

- [ ] **Zugang prüfen:** Die Zusammenfassung zeigt „sofort aktiv“ (Konto gab es schon) oder „Einladung“.
      Eine Einladung wird automatisch eingelöst, sobald sich die Praxis mit `owner_email` anmeldet und den
      E-Mail-Code eingibt – vorher hat niemand Zugang. Stand im SQL-Editor:

  ```sql
  select email, role, accepted_at from app.practice_invites where practice_id = '<praxis-id>';
  ```

  `accepted_at` gefüllt = Zugang aktiv.

- [ ] **In der App prüfen** (Testversion mit Server): Praxis suchen – Name, Adresse, Telefon, Ärztinnen/Ärzte
      stimmen. Der Status ist „Unbekannt“, bis die Praxis zum ersten Mal Termine freigibt oder „Alles aktuell“
      bestätigt. Das ist richtig so.

### A5. Weitere Zugänge (empfohlen: mindestens zwei Personen je Praxis)

Mit zwei Zugängen kann die Praxis weiterarbeiten, wenn jemand fehlt oder sein Authenticator verloren geht.

1. SQL-Editor – Einladung anlegen (die Person meldet sich danach selbst an, Zugang ab der Code-Eingabe):
   `insert into app.practice_invites (practice_id, email, role) values ('<praxis-id>', '<email>', 'staff');`
2. Hat die Person schon ein bestätigtes Konto, stattdessen sofort freischalten:
   `select app.add_practice_member('<praxis-id>', '<email>', 'staff');`

Die Rollen „Leitung“ (`owner`) und „Team“ (`staff`) werden derzeit nur angezeigt; beide dürfen im Dashboard
dasselbe.

### A6. Praxis informieren

Per E-Mail an `owner_email` – **ohne** Codes oder Passwörter. Vorschlag:

> Betreff: Ihr Zugang zum Terminlücke Praxis-Dashboard
>
> Guten Tag [Name],
>
> Ihr Zugang ist eingerichtet. Bitte öffnen Sie https://[PLATZHALTER: Domain]/praxis/ und melden Sie sich mit
> dieser E-Mail-Adresse an. Den 6-stelligen Anmeldecode schicken wir Ihnen dann per E-Mail von
> [PLATZHALTER: Absenderadresse]. Halten Sie bitte ein Smartphone mit einer Authenticator-App bereit.
> Die Anleitung finden Sie im Anhang (Teil B).
>
> Für den gemeinsamen Probelauf schlagen wir [PLATZHALTER: Termin] vor.
>
> Bei Fragen: [PLATZHALTER: Support-Kontakt]

Anhang: Teil B dieses Dokuments und das Infoblatt.

### A7. Laufender Betrieb (Betreiber)

**Authenticator verloren oder neues Handy** (es gibt keine Selbst-Wiederherstellung und keine Backup-Codes):

1. Identität prüfen – z. B. Rückruf unter der öffentlich bekannten Praxisnummer, nicht unter einer Nummer aus
   der Anfrage. [PLATZHALTER: festgelegtes Prüfverfahren]
2. Zweiten Faktor entfernen – im SQL-Editor (oder, falls angeboten, in Supabase Studio unter
   **Authentication → Users** bei der Person):

   ```sql
   delete from auth.mfa_factors
    where user_id = (select id from auth.users where lower(email) = lower('<email>'));
   ```

3. Die Person meldet sich neu an (E-Mail-Code) und richtet die Zwei-Faktor-Anmeldung neu ein.
4. Vorgang mit Datum und Prüfweg dokumentieren.

Bei Verdacht auf Missbrauch (z. B. gestohlenes Handy) den Zugang sofort entziehen – die Datenbank verweigert
dann jeden weiteren Abruf:

```sql
select app.remove_practice_member('<praxis-id>', '<email>');
```

**Mitarbeitende scheiden aus:** ebenfalls `app.remove_practice_member`, danach den Nutzer unter
Authentication → Users löschen.

---

## B. Praxis

Diese Anleitung richtet sich an das Praxisteam. Begriffe in Anführungszeichen sind genau so im Dashboard
beschriftet.

### B1. Was Sie brauchen

- Einen Rechner mit aktuellem Browser. Eine Installation ist nicht nötig.
- Ein Smartphone mit einer **Authenticator-App** für 6-stellige Codes (TOTP). Welche App, ist Ihnen
  überlassen – Beispiele: Google Authenticator, Microsoft Authenticator, FreeOTP, 2FAS, oder ein
  Passwort-Manager mit Code-Funktion.
- Zugriff auf das E-Mail-Postfach, das Sie uns für die Anmeldung genannt haben.

### B2. Erste Anmeldung

1. `https://[PLATZHALTER: Domain]/praxis/` öffnen → „Anmeldung für Praxen“.
2. E-Mail-Adresse eingeben → „Code senden“.
3. E-Mail mit dem Betreff „Ihr Anmeldecode / Your sign-in code“ öffnen, 6-stelligen Code eingeben →
   „Anmelden“. Der Code gilt 15 Minuten; einen neuen Code können Sie nach 60 Sekunden anfordern.
4. **„Zwei-Faktor-Anmeldung“ einrichten:** QR-Code mit der Authenticator-App scannen (oder den angezeigten
   Schlüssel abtippen). In der App erscheint ein neuer Eintrag. Den 6-stelligen Code aus der App eingeben →
   „Bestätigen“.
5. Sie sehen den „Wochenplan“ Ihrer Praxis. (Sind Sie mehreren Praxen zugeordnet, wählen Sie zuerst unter
   „Praxis wählen“.)

Ab jetzt gilt bei **jeder** Anmeldung: Code per E-Mail **und** Code aus der Authenticator-App.

**Kein Code angekommen?** Spam-Ordner prüfen und genau die Adresse verwenden, die Sie uns genannt haben. Aus
Sicherheitsgründen erhalten nicht freigeschaltete Adressen keinen Code – ohne Fehlermeldung. Hilft das nicht,
melden Sie sich bei uns.

**Gut zu wissen:** Die Anmeldung gilt nur in diesem Browser-Tab. Schließen Sie den Tab, sind Sie abgemeldet.
Nach 30 Minuten ohne Eingabe meldet das Dashboard Sie automatisch ab; eine Minute vorher erscheint „Noch da?“
mit „Angemeldet bleiben“. Das schützt Patientendaten an gemeinsam genutzten Rechnern.

### B3. Sprechzeiten-Vorlagen anlegen und anwenden

Vorlagen sind wiederkehrende Zeiten, die Sie über Terminlücke anbieten möchten. Daraus erzeugt das Dashboard die
einzelnen freien Termine.

> **Wichtig:** Geben Sie nur Zeiten frei, die Sie in Ihrem Praxiskalender auch für Terminlücke freihalten. Terminlücke
> sieht Ihren Praxiskalender nicht.

1. Reiter **„Sprechzeiten“** → Bereich „Neue Vorlage“.
2. „Ärztin/Arzt“, „Wochentag“, „Von“, „Bis“, „Termindauer“ (10, 15, 20, 30, 45 oder 60 Min.) und „Art“
   („Vor Ort“ oder „Videosprechstunde“) wählen → „Vorlage hinzufügen“.
   Beispiel: Montag, 08:00–10:00, 15 Min. → Termine um 08:00, 08:15, … 09:45 (8 Termine).
3. Überschneidet sich eine Vorlage mit einer bestehenden derselben Person, lehnt das Dashboard sie ab.
4. Bereich **„Termine erzeugen“**: „Ab Woche“ (aktuelle oder eine der nächsten fünf Wochen) und „Für“
   (1–8 Wochen) wählen. Die Vorschau zeigt „Ergibt bis zu … neue Termine“ → „Termine erzeugen“.

Gut zu wissen:

- Uhrzeiten gelten in deutscher Ortszeit, auch über die Zeitumstellung hinweg.
- Bereits angelegte Zeiten werden übersprungen. Sie können also z. B. jede Woche erneut für die nächsten
  Wochen erzeugen, ohne doppelte Termine.
- Vergangene Zeiten werden nicht angelegt.
- Eine Vorlage zu löschen entfernt **keine** bereits erzeugten Termine. Diese entfernen Sie im Wochenplan
  einzeln (B4).
- Videosprechstunde: Das Dashboard kann solche Termine anlegen, Terminlücke verschickt aber keinen Zugangslink.
  [PLATZHALTER: Im Pilot Videosprechstunden anbieten – ja/nein?]

### B4. Einzelne freie Termine anlegen und entfernen

**Anlegen:** Im „Wochenplan“ auf „Termin anlegen“ (oder auf „+“ beim Tag) → „Ärztin/Arzt“, „Datum“,
„Uhrzeit“, „Dauer“, „Art“ → „Anlegen“. Möglich sind Termine ab jetzt bis 120 Tage im Voraus. Die Meldung
lautet dann:

- „Termin angelegt – er ist sofort in der App sichtbar.“ oder
- „Termin angelegt und sofort einer Person auf der Warteliste angeboten.“ – dann hatte jemand einen passenden
  Termin-Alarm gesetzt.

**Was die Farben/Beschriftungen im Wochenplan bedeuten:**

| Anzeige      | Bedeutung                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| „Frei“       | in der App buchbar                                                                                    |
| „Reserviert“ | jemand bucht gerade (bis 5 Minuten) oder hat ihn per Termin-Alarm angeboten bekommen (bis 10 Minuten) |
| „Gebucht“    | über Terminlücke gebucht – Details unter „Buchungen“                                                  |

**Entfernen:** Termin anklicken → „Termin entfernen“. Das geht nur bei freien Terminen. Tun Sie das immer,
wenn Sie einen freigegebenen Termin anderweitig vergeben (z. B. am Telefon) oder eine Sprechzeit ausfällt.
„Reserviert“ lässt sich nicht entfernen – versuchen Sie es nach wenigen Minuten erneut.

Oben im Wochenplan sehen Sie „Heute frei“, „Frei in dieser Woche“, „Über Terminlücke gebucht“ und
„So sieht die App Sie heute“ (Status und Aktualität).

### B5. Buchungen sehen

Reiter **„Buchungen“**, Zeitraum „Heute“, „7 Tage“ oder „30 Tage“. Je Buchung: Termin, Kontakt (Name),
Telefon, Versicherung, Anlass, Ärztin/Arzt, Status. Bucht jemand für ein Familienmitglied, steht dort
„Für ein Familienmitglied“ mit Altersgruppe; Name und Telefon sind die der buchenden Person.

- **Neue Buchungen:** Ist das Dashboard geöffnet, erscheint „Neue Buchung eingegangen.“ Eine E-Mail oder
  andere Benachrichtigung gibt es **nicht** – schauen Sie deshalb regelmäßig unter „Buchungen“ nach
  (Vorschlag: morgens und mittags).
- **In den Praxiskalender übernehmen:** Tragen Sie jede Terminlücke-Buchung in Ihr Praxisverwaltungssystem ein.
  Terminlücke ist kein Archiv: Buchungen verschwinden z. B., wenn die Person ihr Konto löscht.
- **Storniert die Person selbst in der App,** steht die Buchung auf „Abgesagt“, die Kontaktdaten sind
  entfernt, und der Termin ist automatisch wieder frei – passende Termin-Alarme bekommen ihn sofort angeboten.
  Sie müssen nur Ihren Praxiskalender anpassen.
- Kontaktdaten nur für die Terminabwicklung verwenden. Jeder Abruf wird protokolliert.

### B6. Termine absagen

Wenn die **Praxis** einen gebuchten Termin nicht halten kann:

1. „Buchungen“ → bei der Buchung „Absagen“ → „Termin absagen“.
2. Die Person erhält eine Mitteilung „Die Praxis hat einen Ihrer Termine abgesagt. Details in der App.“ –
   ohne Praxis, Ärztin/Arzt oder Uhrzeit.
3. Der Termin wird **nicht** erneut angeboten. Wenn die Zeit doch frei ist, legen Sie einen neuen Termin an.

Bei kurzfristigen Absagen empfehlen wir, die Person zusätzlich anzurufen (Telefonnummer steht in der Buchung).

**Sagt die Person bei Ihnen telefonisch ab:** Bitten Sie sie, in der App zu stornieren – dann wird der Termin
automatisch weitervergeben. Geht das nicht, sagen Sie über „Absagen“ ab (die Person erhält dann trotzdem die
Mitteilung „Die Praxis hat … abgesagt“) und legen Sie bei Bedarf zur selben Zeit einen neuen freien Termin an.

### B7. „Alles aktuell“ bestätigen

Die App zeigt bei Ihrer Praxis, wie aktuell die Angaben sind („Aktualisiert vor … Min.“).

- **Jede Änderung zählt als Bestätigung:** Termin anlegen oder entfernen, Termin absagen, „Termine erzeugen“.
  (Vorlagen anlegen oder löschen allein zählt nicht.)
- **Ohne Änderung:** Im „Wochenplan“, Feld „So sieht die App Sie heute“, auf **„Alles aktuell“** klicken →
  „Danke – Ihre Termine gelten jetzt als aktuell.“
- **Nach mehr als 24 Stunden** ohne Änderung oder Bestätigung zeigt die App bei Ihrer Praxis den Status
  **„Unbekannt“** mit „Keine aktuellen Termindaten – bitte anrufen“. Auf Ihrer Praxisseite bietet die App dann
  keine Buchung an (nur Angebote aus Termin-Alarmen gehen weiter hinaus), und in der Suche stehen Sie hinter
  Praxen mit aktuellen Angaben.
- Vorschlag für den Ablauf an jedem Praxistag: Buchungen prüfen und übernehmen → anderweitig vergebene Termine
  entfernen → „Alles aktuell“.
- Achtung Wochenende und Feiertage: Eine Bestätigung am Freitagmittag läuft am Samstagmittag ab. Bis zur
  nächsten Bestätigung zeigt die App „Unbekannt“.

### B8. Authenticator verloren oder neues Smartphone

- Beim **Wechsel** des Smartphones: Authenticator-Einträge übertragen, **bevor** Sie das alte Gerät
  zurücksetzen (die meisten Apps bieten eine Übertragungsfunktion).
- Bei **Verlust:** Melden Sie sich sofort bei uns ([PLATZHALTER: Support-Kontakt]). Eine Selbst-Wiederherstellung
  gibt es nicht. Wir prüfen Ihre Identität (z. B. per Rückruf unter Ihrer Praxisnummer), entfernen den alten
  zweiten Faktor, und Sie richten ihn bei der nächsten Anmeldung neu ein (wie in B2, Schritt 4).
- Bis dahin können Sie sich mit diesem Zugang nicht anmelden. Kolleginnen und Kollegen mit eigenem Zugang
  können weiterarbeiten.

### B9. Zugänge im Team

- Jede Person hat einen **eigenen** Zugang mit eigenem Authenticator. Zugänge nicht teilen.
- Neue Zugänge und das Entfernen von Zugängen (z. B. wenn jemand die Praxis verlässt) beim Terminlücke-Team
  anfragen – das geht derzeit nicht im Dashboard selbst.

---

## C. Gemeinsamer Probelauf (Checkliste)

Dauer ca. 30 Minuten (Annahme). Beteiligt: eine Person aus der Praxis (angemeldet im Dashboard) und der
Betreiber mit einem Testgerät.

**Vorbereitung**

- Testgerät: echtes Smartphone mit der Testversion mit Server (`preview-backend`, `docs/test-builds.md`),
  Mitteilungen erlaubt. Simulatoren erhalten keine Push-Mitteilungen.
- Eigenes Konto in der App (E-Mail-Code). Für Schritt 6 ein zweites Konto auf einem zweiten Gerät.
- **Achtung:** Testtermine sind für alle Nutzenden der App sichtbar. Probelauf vor dem öffentlichen Start oder
  mit Zeiten, die die Praxis notfalls auch wahrnehmen könnte – und am Ende aufräumen (Schritt 9).

| #   | Schritt                                                                                                                           | Erwartet                                                                                                                                                                  | OK  |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 1   | Praxis legt einen freien Termin an (heute oder morgen)                                                                            | Meldung „Termin angelegt – er ist sofort in der App sichtbar.“; in der App Status „Frei“ oder „Wenige frei“, „Von der Praxis gepflegt“, „Gerade aktualisiert“             | [ ] |
| 2   | **Testbuchung** mit dem eigenen Konto                                                                                             | Dashboard: „Neue Buchung eingegangen.“; unter „Buchungen“ Name, Telefon, Versicherung, Anlass; im Wochenplan „Gebucht“                                                    | [ ] |
| 3   | Praxis sagt die Testbuchung ab („Absagen“ → „Termin absagen“)                                                                     | Gerät: Mitteilung „Die Praxis hat einen Ihrer Termine abgesagt. Details in der App.“; in der App storniert; Dashboard: „Abgesagt“, „Kontaktdaten nach Absage entfernt“    | [ ] |
| 4   | Alle freien Testtermine im Zeitraum entfernen; Testkonto setzt bei der Praxis einen **Termin-Alarm** (z. B. „Nächste 3 Tage“)     | App: „Ihr Termin-Alarm ist aktiv.“ bzw. „Dein Termin-Alarm ist aktiv.“                                                                                                    | [ ] |
| 5   | Praxis legt im Zeitraum einen neuen Termin an                                                                                     | Dashboard: „… sofort einer Person auf der Warteliste angeboten.“; Gerät: „Ein Termin in Ihrer Nähe ist frei geworden. Tippen Sie zum Bestätigen.“; nach Buchung „Gebucht“ | [ ] |
| 6   | Optional, zweites Gerät: Konto B bucht den einzigen freien Termin, Konto A setzt einen Termin-Alarm, Konto B storniert in der App | Konto A erhält das Angebot ohne Zutun der Praxis (Wochenplan erst „Reserviert“); „Buchungen“ zeigt die Buchung von B als „Abgesagt“                                       | [ ] |
| 7   | **Datenschutz-Check:** Mitteilungen aus 3 und 5 auf dem Sperrbildschirm ansehen; Dashboard-Tab schließen und neu öffnen           | Sperrbildschirm ohne Praxis, Ärztin/Arzt, Fachrichtung, Uhrzeit, Anlass; nach dem Schließen ist eine neue Anmeldung nötig                                                 | [ ] |
| 8   | Betreiber prüft das Zugriffsprotokoll (SQL unten)                                                                                 | Einträge `create_slot`, `view_bookings`, `cancel_appointment` mit Zeitpunkt                                                                                               | [ ] |
| 9   | **Aufräumen:** offene Testbuchungen stornieren, Testtermine entfernen, Termin-Alarme löschen; zum Schluss „Alles aktuell“         | Keine Testdaten mehr im Wochenplan; App zeigt „Gerade aktualisiert“                                                                                                       | [ ] |

Hinweise: Termin-Alarm-Angebote gehen an den ersten passenden aktiven Alarm (Reihenfolge nach Eintragung).
Haben echte Nutzende einen passenden Alarm, kann das Angebot dort landen statt auf dem Testgerät.
Fehlt eine Mitteilung: `docs/push-setup.md`, Abschnitt „Prüfen“ und Fehlersuche.

```sql
-- Zugriffsprotokoll der Praxis (letzte 20 Einträge)
select at, action, target, details
  from app.practice_audit_log
 where practice_id = '<praxis-id>'
 order by at desc
 limit 20;
```

---

## D. Go-Live und Feedback

### D1. Go-Live

- [ ] Probelauf vollständig „OK“, Probleme behoben oder bewusst akzeptiert.
- [ ] Startdatum: [PLATZHALTER]
- [ ] Praxis hat ihr erstes reguläres Kontingent erzeugt (B3) und weiß, wer im Team täglich Buchungen prüft,
      übernimmt und „Alles aktuell“ bestätigt.
- [ ] Ansprechperson und Vertretung auf beiden Seiten benannt: [PLATZHALTER]
- [ ] Termine für die Feedbackgespräche nach 2 und 6 Wochen vereinbart.

**Bitte notiert die Praxis bis zum Feedback (freiwillig, ohne Patientendaten):**

- Nicht erschienene Terminlücke-Termine (No-Shows) als Strichliste – das Dashboard erfasst das nicht.
- Wenn möglich: Anrufe wegen Terminsuche als Strichliste, eine typische Woche vor dem Start und eine im Pilot.
- Stellen, an denen es gehakt hat (Datum, Uhrzeit, was passiert ist; Screenshots nur ohne Patientendaten).

**Zahlen, die der Betreiber vor jedem Gespräch zieht** (SQL-Editor, Praxis-ID und Zeitraum anpassen):

```sql
with p as (
  select '<praxis-id>'::uuid as id,
         timestamptz '2026-10-20 00:00+02' as von,
         now() as bis
)
select
  (select count(*) from public.availability_slots s
    where s.practice_id = p.id and s.source = 'practice_dashboard'
      and s.starts_at >= p.von and s.starts_at < p.bis) as angelegte_termine,
  (select count(*) from public.appointments a
    where a.practice_id = p.id and a.created_at >= p.von and a.created_at < p.bis) as buchungen,
  (select count(*) from public.appointments a
    where a.practice_id = p.id and a.status = 'cancelled'
      and a.cancelled_at >= p.von and a.cancelled_at < p.bis) as absagen_gesamt,
  (select count(*) from app.practice_audit_log l
    where l.practice_id = p.id and l.action = 'cancel_appointment'
      and l.at >= p.von and l.at < p.bis) as absagen_durch_praxis,
  (select count(*) from public.waitlist_offers o
    join public.availability_slots s on s.id = o.slot_id
    where s.practice_id = p.id and o.offered_at >= p.von and o.offered_at < p.bis) as alarm_angebote,
  (select count(*) from public.waitlist_offers o
    join public.availability_slots s on s.id = o.slot_id
    where s.practice_id = p.id and o.status = 'accepted'
      and o.offered_at >= p.von and o.offered_at < p.bis) as alarm_angenommen
from p;
```

`angelegte_termine` enthält auch später entfernte Termine. Angebote aus Termin-Alarmen werden nach 90 Tagen
gelöscht, Termine nach 12 Monaten (`app.retention()`).

### D2. Fragen nach 2 Wochen

Ziel: Hürden im Alltag finden. Nur Fragen – Antworten in den Gesprächsnotizen festhalten
([PLATZHALTER: Ablageort], ohne Patientendaten).

**Aufwand**

- Wie viel Zeit hat die Pflege im Dashboard pro Praxistag ungefähr gekostet? Wer hat es gemacht?
- Welche Schritte waren umständlich oder doppelt (z. B. Buchungen in den Praxiskalender übertragen)?
- Hat die Anmeldung mit E-Mail-Code und Authenticator im Alltag funktioniert? Wie oft war eine neue Anmeldung
  nötig (Tab geschlossen, 30-Minuten-Abmeldung)? Hat das gestört?
- War „Alles aktuell“ verständlich? Wurde es vergessen? Stand die Praxis zeitweise auf „Unbekannt“?
- Waren die Sprechzeiten-Vorlagen passend, oder wurden die meisten Termine einzeln angelegt?

**Buchungen und No-Shows**

- Passen die Buchungszahlen (vom Betreiber mitgebracht) zu Ihrem Eindruck?
- Wie viele Personen mit Terminlücke-Termin sind nicht erschienen (Strichliste)?
- Haben die Angaben in der Buchung (Name, Telefon, Versicherung, Anlass) gereicht? Fehlte etwas, war etwas
  überflüssig?
- Gab es Doppelbelegungen, also Termine, die schon anderweitig vergeben waren?

**Telefonentlastung**

- Haben Sie weniger, gleich viele oder mehr Anrufe zur Terminsuche bemerkt? (Strichliste, falls geführt)
- Haben Personen wegen ihres Terminlücke-Termins angerufen (Rückfragen, Bestätigung, Absage)?

**Termin-Alarm und Leerlauf**

- Haben Sie bemerkt, dass frei gewordene Termine über die App neu belegt wurden?
- Gab es kurzfristige Lücken, die Sie gern über Terminlücke angeboten hätten, aber nicht angeboten haben? Warum?

**Verbesserungswünsche**

- Was fehlt Ihnen im Dashboard am meisten?
- Was war unklar oder hat verunsichert?
- Gab es technische Probleme (Browser, Anmeldung, Ladezeiten, Darstellung)?

### D3. Fragen nach 6 Wochen

Ziel: Wirkung einschätzen und über die Fortsetzung sprechen. Zusätzlich zu den Fragen aus D2:

**Aufwand**

- Hat sich der Aufwand eingespielt? Wie viel Zeit pro Praxistag heute im Vergleich zum Start?
- Bieten Sie heute mehr oder weniger Termine über Terminlücke an als am Anfang? Warum?

**No-Shows**

- Ihre Einschätzung: Erscheinen Personen mit Terminlücke-Termin anders zuverlässig als bei telefonisch vereinbarten
  Terminen? Worauf stützt sich die Einschätzung?

**Telefonentlastung**

- Ihre Einschätzung zur Entlastung am Telefon nach 6 Wochen? Hat sich etwas gegenüber Woche 2 verändert?

**Patient:innen und Datenschutz**

- Welche Rückmeldungen haben Patient:innen zu Terminlücke gegeben?
- Gab es Fragen von Patient:innen oder im Team zum Datenschutz? Fühlten Sie sich mit dem Dashboard sicher?

**Fortsetzung und Verbesserungen**

- Würden Sie Terminlücke nach dem Pilot weiter nutzen? Unter welchen Bedingungen?
- Welche drei Änderungen wären für Sie am wichtigsten?
- Würden Sie Terminlücke einer Kollegin oder einem Kollegen empfehlen? Was müsste sich dafür ändern?
- Dürfen wir Ihre Rückmeldung verwenden – anonym oder mit Nennung der Praxis? (Regelung in der Vereinbarung)
