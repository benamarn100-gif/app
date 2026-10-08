# Pilot-Vereinbarung zur Nutzung des MedNow Praxis-Dashboards

> Stand: 07.10.2026.
>
> **ENTWURF – vor Verwendung anwaltlich prüfen lassen.**
>
> Technische Vorbereitung, keine Rechtsberatung. Offene Entscheidungen sind mit **Entscheidung offen**
> markiert, fehlende Angaben mit `[PLATZHALTER: …]`. Technische Angaben beziehen sich auf
> `supabase/migrations/20261006000800_practice_dashboard.sql` und `dashboard/README.md`.

## § 1 Parteien

1. **Betreiber:** [PLATZHALTER: Name/Firma, Rechtsform, Anschrift, vertreten durch] – nachfolgend „Betreiber“.
2. **Praxis:** [PLATZHALTER: Praxisname, Rechtsform, Anschrift, vertreten durch] – nachfolgend „Praxis“.

## § 2 Gegenstand und Laufzeit

1. Der Betreiber stellt der Praxis das Praxis-Dashboard von MedNow im Rahmen einer Pilotphase kostenlos zur
   Verfügung. Mit dem Dashboard gibt die Praxis freie Termine frei, verwaltet Sprechzeiten-Vorlagen, sieht
   Buchungen, die über die MedNow-App eingehen, und sagt Termine ab.
2. Patient:innen finden die freigegebenen Termine in der MedNow-App und buchen sie dort. Ein
   Behandlungsvertrag kommt ausschließlich zwischen Praxis und Patient:in zustande, nicht mit dem Betreiber.
3. Die Praxis entscheidet selbst, welche und wie viele Termine sie freigibt. Eine Mindestmenge besteht nicht.
4. Laufzeit: vom [PLATZHALTER: Startdatum] bis [PLATZHALTER: Enddatum; Vorschlag 3 Monate]. Die Vereinbarung
   endet mit Ablauf der Laufzeit, ohne dass es einer Kündigung bedarf. Eine Verlängerung bedarf der Textform.
5. Bestandteil dieser Vereinbarung sind: Anlage 1 Infoblatt (`docs/pilot/praxis-infoblatt.md`), Anlage 2
   Ablauf und Anleitung (`docs/pilot/praxis-onboarding.md`), Anlage 3 Datenschutzregelung nach § 6,
   Anlage 4 technische und organisatorische Maßnahmen [PLATZHALTER].

## § 3 Pflichten der Praxis

Die Praxis

1. **hält ihre Termine aktuell:** Sie gibt nur Termine frei, die sie tatsächlich wahrnehmen kann, entfernt
   anderweitig vergebene oder ausfallende Termine unverzüglich im Dashboard und bestätigt ihre Angaben an jedem
   Praxistag – durch eine Änderung oder über „Alles aktuell“. Der Praxis ist bekannt, dass die App nach mehr
   als 24 Stunden ohne Bestätigung den Status „Unbekannt“ zeigt.
2. **sagt Termine im System ab:** Kann die Praxis einen über MedNow gebuchten Termin nicht halten, sagt sie ihn
   über das Dashboard ab („Absagen“), damit die Person in der App benachrichtigt wird.
   [PLATZHALTER: Ob die Praxis bei kurzfristigen Absagen zusätzlich direkt informieren muss, z. B. telefonisch
   bei weniger als 24 Stunden Vorlauf.]
3. **nimmt gebuchte Termine wahr** und übernimmt sie in ihr eigenes Terminsystem. Das Dashboard ist kein
   Archiv; benötigte Angaben dokumentiert die Praxis in ihren eigenen Systemen.
4. **nutzt die Zwei-Faktor-Anmeldung:** Jede Person richtet die Zwei-Faktor-Anmeldung mit einer
   Authenticator-App auf einem Gerät unter ihrer Kontrolle ein. Verlust oder Verdacht auf Missbrauch eines
   Geräts oder Zugangs meldet die Praxis dem Betreiber unverzüglich.
5. **teilt Zugänge nicht:** Jeder Zugang gehört genau einer Person. Neue Zugänge beantragt die Praxis beim
   Betreiber; das Ausscheiden einer Person meldet sie unverzüglich, damit der Zugang entfernt wird.
6. **weist ihre Mitarbeitenden ein:** in die Bedienung des Dashboards und in den Umgang mit den angezeigten
   Kontaktdaten, die nur für die Terminabwicklung genutzt werden dürfen.
7. **hält ihre Praxisangaben richtig:** Name, Adresse, Telefon, Website, Fachrichtungen, Ärztinnen/Ärzte und
   Sprachen; Änderungen teilt sie dem Betreiber mit.

## § 4 Pflichten des Betreibers

Der Betreiber

1. **stellt das Dashboard nach bestem Bemühen bereit.** Eine bestimmte Verfügbarkeit wird nicht zugesichert.
   Geplante Wartungen kündigt er nach Möglichkeit [PLATZHALTER: Vorlauf] vorher an.
2. **richtet Zugänge ein und entfernt sie** innerhalb von [PLATZHALTER: Frist] nach Anfrage der Praxis; bei
   Verdacht auf Missbrauch unverzüglich. Bei Verlust eines Authenticators prüft er die Identität der Person,
   bevor er den zweiten Faktor zurücksetzt.
3. **ist erreichbar** unter [PLATZHALTER: Support-E-Mail, Telefon, Erreichbarkeit].
4. **schützt die Daten** nach § 6 und Anlage 4, insbesondere: Datenbank und Anmeldung bei Supabase in der
   EU-Region Frankfurt; Zwei-Faktor-Pflicht für alle Praxis-Zugänge; Name, Telefonnummer und Anlass werden
   verschlüsselt gespeichert; Zugriffsprotokoll; automatische Abmeldung im Dashboard nach 30 Minuten ohne
   Aktivität; Mitteilungen an Patient:innen ohne Praxis, Ärztin/Arzt und Uhrzeit auf dem Sperrbildschirm.
5. **informiert die Praxis** über Datenschutzverletzungen, die ihre Daten oder Buchungen betreffen,
   unverzüglich, spätestens innerhalb von [PLATZHALTER: Stunden].
6. **behandelt alle gleich:** Die Reihenfolge, in der frei gewordene Termine über Termin-Alarme angeboten
   werden, hängt nicht von einer Bezahlung durch Patient:innen ab (Reihenfolge nach Eintragungszeit,
   Reservierungszeit 10 Minuten für alle). Die Reihenfolge der Praxen in der Suche hängt nicht von einer
   Bezahlung durch Praxen ab.

## § 5 Kein Entgelt, keine Provision

1. Die Nutzung ist während der Pilotphase für die Praxis kostenlos.
2. Es wird weder ein Entgelt noch eine Provision noch ein sonstiger Vorteil je vermitteltem Termin oder je
   Patient:in vereinbart – in keine Richtung. Der Betreiber zahlt der Praxis nichts, die Praxis zahlt dem
   Betreiber nichts.
3. Hinweis: Nach § 31 MBO-Ä (in der Fassung der jeweiligen Berufsordnung der Landesärztekammer) ist es
   Ärztinnen und Ärzten nicht gestattet, für die Zuweisung von Patient:innen ein Entgelt oder andere Vorteile
   zu fordern, sich versprechen oder gewähren zu lassen oder selbst zu versprechen oder zu gewähren.
   Zusätzlich anwaltlich zu prüfen: §§ 299a, 299b StGB. Ein späteres Preismodell wird vorher rechtlich geprüft
   und gesondert vereinbart; ohne neue Vereinbarung entstehen der Praxis keine Kosten.

## § 6 Datenschutz

### 6.1 Welche Daten fließen

| Richtung           | Daten                                                                                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Praxis → Betreiber | Praxisangaben, Namen der Ärztinnen/Ärzte, freie Termine und Sprechzeiten-Vorlagen, E-Mail-Adressen der Mitarbeitenden (Anmeldung)                                                                                          |
| Betreiber → Praxis | je bestätigter Buchung: Name und Telefonnummer der buchenden Person, Versicherungsart (gesetzlich/privat), Anlass aus fester Liste, bei Familienmitgliedern nur die Altersgruppe, Termin, Ärztin/Arzt, Art (vor Ort/Video) |
| beim Betreiber     | Zugriffsprotokoll: Person, Zeitpunkt, Aktion (Abruf der Buchungsliste mit Zeitraum und Anzahl, Termin angelegt/entfernt, Termin abgesagt, Vorlage angelegt/gelöscht, Vorlagen angewendet)                                  |

Nach einer Absage liefert das Dashboard keine Kontaktdaten mehr. Freitexte und Diagnosen werden nicht
erhoben.

### 6.2 Rollenverteilung – Entscheidung offen

**Entscheidung offen** (nach anwaltlicher Prüfung ankreuzen; `docs/legal-checklist.md`, Abschnitt 3):

- [ ] **Variante A – gemeinsame Verantwortlichkeit (Art. 26 DSGVO).** Betreiber und Praxis legen die Zwecke
      der Terminvermittlung gemeinsam fest. Eine Vereinbarung nach Art. 26 regelt insbesondere: wer die
      Informationspflichten (Art. 13, 14) erfüllt – Betreiber in der App, Praxis in ihrer
      Datenschutzinformation –, welche Anlaufstelle Betroffenenrechte bearbeitet, wie sich die Parteien bei
      Datenschutzverletzungen gegenseitig informieren, und dass der wesentliche Inhalt den Betroffenen zur
      Verfügung gestellt wird (Art. 26 Abs. 2). Passt dazu, dass der Betreiber eigene Beziehungen zu
      Patient:innen hat (App-Konto, Einwilligung, Termin-Alarm). Zu beachten: gemeinsame Haftung gegenüber
      Betroffenen (Art. 82 Abs. 4).
- [ ] **Variante B – Auftragsverarbeitung (Art. 28 DSGVO).** Die Praxis ist Verantwortliche für ihre
      Terminverwaltung im Dashboard, der Betreiber verarbeitet weisungsgebunden. Ein AV-Vertrag mit den
      Mindestinhalten nach Art. 28 Abs. 3 (Weisungen, Vertraulichkeit, Maßnahmen nach Art. 32,
      Unterauftragsverarbeiter, Unterstützung bei Betroffenenrechten, Löschung/Rückgabe, Nachweise und
      Kontrollen); Unterauftragsverarbeiter: Supabase (Region Frankfurt, US-Mutterkonzern – Übermittlung
      prüfen), E-Mail-Versand [PLATZHALTER], Hosting des Dashboards [PLATZHALTER]; Verpflichtung zur
      Verschwiegenheit nach § 203 StGB prüfen. Zu beachten: Für App-Konto, Einwilligung und Termin-Alarm ist
      der Betreiber ohnehin selbst verantwortlich – Variante B deckt nur den Dashboard-Teil ab.
- [ ] **Andere Lösung** nach anwaltlicher Empfehlung (z. B. getrennte Verantwortlichkeit): [PLATZHALTER]

Die gewählte Regelung wird als Anlage 3 beigefügt.

### 6.3 Zugriffsprotokoll

Der Betreiber protokolliert jeden Abruf der Buchungsliste und jede Änderung im Dashboard mit Person und
Zeitpunkt (`app.practice_audit_log`) zur Sicherheit der Verarbeitung (Art. 32 DSGVO) und zur Aufklärung von
Missbrauch. Aufbewahrung: **12 Monate**, danach automatische Löschung. Die Praxis erhält auf Anfrage einen
Auszug für ihre Praxis innerhalb von [PLATZHALTER: Frist]; eine Einsicht im Dashboard selbst gibt es derzeit
nicht.

### 6.4 Löschfristen

Ein täglicher Job (`app.retention()`) löscht automatisch:

| Daten                                                                            | Gelöscht nach             |
| -------------------------------------------------------------------------------- | ------------------------- |
| Termine einschließlich Kontaktdaten (Name, Telefon, Versicherungsart) und Anlass | 12 Monate nach Terminende |
| Zugriffsprotokoll                                                                | 12 Monate                 |
| Angebote aus Termin-Alarmen                                                      | 90 Tage nach dem Angebot  |
| Beendete Termin-Alarme                                                           | 90 Tage nach dem Anlegen  |
| Warteschlange für Mitteilungen an Patient:innen                                  | 30 Tage                   |

Löscht eine Person ihr MedNow-Konto, werden ihre künftigen Termine storniert und ihre Daten sofort gelöscht;
die Buchung ist dann auch im Dashboard nicht mehr sichtbar. Die 12-Monats-Frist ist mit den
Aufbewahrungspflichten der Praxis abzugleichen; Behandlungsdokumentation führt die Praxis in ihren eigenen
Systemen. [PLATZHALTER: Ergebnis des Abgleichs]

## § 7 Haftung

[PLATZHALTER: anwaltliche Formulierung. Zu prüfen u. a.: Haftungsmaßstab bei unentgeltlicher Überlassung,
Haftung für Vorsatz und grobe Fahrlässigkeit sowie für Verletzung von Leben, Körper und Gesundheit, Folgen
eines Ausfalls des Dashboards oder der App (z. B. nicht übermittelte Buchungen), Haftung im Innenverhältnis
je nach Variante in § 6.2.]

## § 8 Kündigung und Ende

1. Beide Parteien können diese Vereinbarung jederzeit ohne Angabe von Gründen mit einer Frist von
   [PLATZHALTER: Vorschlag 14 Tage] in Textform kündigen.
2. Das Recht zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt, z. B. bei Missbrauch von
   Zugängen oder schweren Datenschutzverstößen.
3. Mit dem Ende entfernt der Betreiber alle Zugänge der Praxis; die Praxis ist in der App nicht mehr buchbar.
   [PLATZHALTER: Umgang mit bereits gebuchten künftigen Terminen – Vorschlag: Die Praxis nimmt sie wahr oder sagt
   sie vor dem Ende über das Dashboard ab.]
4. Für die gespeicherten Daten gelten die Fristen nach § 6.4, soweit Anlage 3 nichts anderes bestimmt.
   [PLATZHALTER: Löschung oder Anonymisierung der Praxisangaben nach Vertragsende]

## § 9 Feedback

1. Die Praxis nimmt nach 2 und 6 Wochen an je einem Feedbackgespräch teil (Fragen in Anlage 2, Teil D).
   Die Teilnahme ist freiwillig, aber für den Zweck des Pilots wichtig.
2. Der Betreiber darf das Feedback und die Nutzungszahlen der Praxis (z. B. Anzahl freigegebener und gebuchter
   Termine) zur Verbesserung von MedNow auswerten.
3. Eine Veröffentlichung von Zitaten oder die Nennung der Praxis als Referenz erfolgt nur mit gesonderter
   Zustimmung der Praxis in Textform. Veröffentlichte Zahlen dürfen keinen Rückschluss auf die Praxis zulassen,
   sofern die Praxis nicht zugestimmt hat.
4. Feedback enthält keine Patientendaten.

## § 10 Schlussbestimmungen

1. Änderungen und Ergänzungen bedürfen der Textform.
2. [PLATZHALTER: salvatorische Klausel, anwendbares Recht, Gerichtsstand]

## Unterschriften

|              | Praxis | Betreiber |
| ------------ | ------ | --------- |
| Name         |        |           |
| Funktion     |        |           |
| Ort, Datum   |        |           |
| Unterschrift |        |           |
