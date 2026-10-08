# MedNow für Praxen – Infoblatt zur Pilotphase

> Stand: 07.10.2026.
> Für Praxen, die MedNow in einer kostenlosen Pilotphase ausprobieren möchten. Zum Ausdrucken oder Weiterleiten.

## Kurz gesagt

MedNow ist eine App, mit der Patient:innen freie Arzttermine in ihrer Nähe finden und direkt buchen.
Ihre Praxis gibt freie Termine über das **Praxis-Dashboard** frei – eine Web-Seite, die im Browser läuft.
Wir suchen 1–2 Praxen, die das [PLATZHALTER: Laufzeit, Vorschlag 3 Monate] lang mit uns ausprobieren und uns
offen sagen, was im Praxisalltag funktioniert und was nicht.

[PLATZHALTER: Wo und seit wann die App für Patient:innen verfügbar ist.]

## So funktioniert MedNow

- **In der App (für Patient:innen):** Suche nach Fachrichtung und Ort. Jede Praxis hat einen Status:
  „Frei“, „Wenige frei“, „Ausgebucht“ oder „Unbekannt“. Zum Buchen gibt die Person Name, Telefonnummer,
  Versicherung (gesetzlich/privat) und einen Anlass aus einer festen Liste an, z. B. „Kontrolltermin“ oder
  „Rezept“. Suchen, Buchen und Notfall-Hilfe sind für Patient:innen kostenlos.
- **Termin-Alarm:** Patient:innen können sich benachrichtigen lassen, sobald bei Ihnen – oder in ihrer
  Fachrichtung in der Nähe – ein passender Termin frei wird.
- **Im Praxis-Dashboard (für Ihr Team):** Wochenplan, Sprechzeiten-Vorlagen, Buchungen und Absagen. Neu
  angelegte Termine sind sofort in der App sichtbar.

## Was hat Ihre Praxis davon?

- **Weniger Anrufe zur Terminsuche:** Patient:innen sehen Ihre freien Termine und buchen selbst – ohne Anruf.
  Wie stark das Ihr Telefon entlastet, wollen wir im Pilot gemeinsam herausfinden.
- **Frei gewordene Termine finden schneller jemanden:** Storniert eine Person ihren MedNow-Termin in der App,
  ist der Platz sofort wieder frei und wird automatisch der ersten passenden Person mit Termin-Alarm angeboten
  (10 Minuten für sie reserviert). Dasselbe gilt für Termine, die Sie kurzfristig neu freigeben. Das kann
  Leerlauf verringern – ob und wie oft, sehen wir im Pilot.
- **Erinnerungen:** Patient:innen können sich in der App 24 Stunden und 2 Stunden vor dem Termin erinnern lassen.
- **Sie behalten die Kontrolle:** Sie entscheiden, welche und wie viele Termine Sie über MedNow anbieten.
  Eine Mindestmenge gibt es nicht.
- **Sichtbarkeit:** Ihre Praxis erscheint mit Adresse, Telefonnummer, Fachrichtung, Sprachen und dem Hinweis
  „Von der Praxis gepflegt“.

## Was Ihre Praxis tun muss

**Einmalig**

1. Uns Ihre Praxisdaten nennen: Name, Adresse, Telefon, Website, Fachrichtung, Namen der Ärztinnen und Ärzte,
   Sprachen, E-Mail-Adresse für die Anmeldung.
2. Erste Anmeldung im Dashboard und Zwei-Faktor-Anmeldung mit einer Authenticator-App einrichten.
3. Sprechzeiten-Vorlagen anlegen, z. B. „Montag 8–10 Uhr, Termine à 15 Minuten“. Daraus erzeugt das Dashboard
   die Termine für bis zu 8 Wochen.
4. Gemeinsamer Probelauf mit uns: Testbuchung, Absage, Termin-Alarm.

**Laufend**

- **Freie Termine freigeben** – über die Vorlagen oder einzeln mit „Termin anlegen“.
- **Buchungen in Ihren Praxiskalender übernehmen.** MedNow ist nicht mit Ihrem Praxisverwaltungssystem
  verbunden. Neue Buchungen sehen Sie im Dashboard unter „Buchungen“.
- **Anderweitig vergebene Termine entfernen.** Vergeben Sie einen freigegebenen Termin am Telefon, entfernen
  Sie ihn im Dashboard, damit ihn niemand zusätzlich bucht.
- **Absagen im Dashboard.** Muss die Praxis einen gebuchten Termin absagen, bitte über „Absagen“ – dann erhält
  die Person eine Mitteilung in der App.
- **Einmal täglich bestätigen.** Jede Änderung im Dashboard zählt als Bestätigung; ohne Änderung genügt ein
  Klick auf „Alles aktuell“. Nach 24 Stunden ohne Bestätigung zeigt die App bei Ihrer Praxis „Unbekannt“ und
  bietet auf Ihrer Praxisseite keine Buchung an.

**Geschätzter Aufwand** – _Annahme, nicht gemessen; wir überprüfen sie im Pilot gemeinsam._

| Was                                                                 | Geschätzt                                                 |
| ------------------------------------------------------------------- | --------------------------------------------------------- |
| Einrichtung (Anmeldung, Zwei-Faktor, Vorlagen)                      | ca. 30–45 Minuten, einmalig                               |
| Probelauf mit uns                                                   | ca. 30 Minuten, einmalig                                  |
| Laufende Pflege (Buchungen übernehmen, Termine pflegen, bestätigen) | ca. 5–15 Minuten je Praxistag, je nach Zahl der Buchungen |
| Feedbackgespräche nach 2 und 6 Wochen                               | je ca. 30 Minuten                                         |

## Was Ihre Praxis nicht tun muss

- Keine Software installieren – das Dashboard läuft in einem aktuellen Browser.
- Keine Schnittstelle zum Praxisverwaltungssystem, keine Änderung an Ihrer Praxis-IT.
- Keine Patientendaten an MedNow übermitteln – Sie geben nur freie Termine frei.
- Keine Mindestanzahl an Terminen anbieten.

## Kosten

In der Pilotphase ist MedNow für Ihre Praxis **kostenlos**. Es gibt keine Gebühr und keine Provision je Termin.
Ob und zu welchen Bedingungen es nach dem Pilot weitergeht, besprechen wir vor dem Ende der Pilotphase. Kosten
entstehen nur, wenn Sie einer neuen Vereinbarung zustimmen.

## Sicherheit und Datenschutz

- **Server in Frankfurt am Main:** Datenbank und Anmeldung laufen bei Supabase in der EU-Region Frankfurt.
- **Zwei-Faktor-Pflicht:** Anmeldung mit einem Code per E-Mail und einem Code aus einer Authenticator-App.
  Ohne zweiten Faktor gibt die Datenbank keine Daten heraus.
- **Nur nötige Patientendaten:** Für bestätigte Termine sehen Sie Name, Telefonnummer, Versicherungsart und den
  Anlass aus der festen Liste – keine Freitexte, keine Diagnosen. Bucht jemand für ein Familienmitglied, sehen
  Sie nur dessen Altersgruppe. Nach einer Absage zeigt das Dashboard keine Kontaktdaten mehr an.
- **Verschlüsselt gespeichert:** Name, Telefonnummer und Anlass liegen zusätzlich verschlüsselt in der Datenbank.
- **Zugriffsprotokoll:** Jeder Abruf der Buchungsliste und jede Änderung wird mit Person und Zeitpunkt
  protokolliert und 12 Monate aufbewahrt.
- **Geeignet für gemeinsam genutzte Rechner:** Die Anmeldung endet, wenn der Browser-Tab geschlossen wird, und
  automatisch nach 30 Minuten ohne Aktivität (mit Vorwarnung).
- **Diskrete Mitteilungen:** Mitteilungen an Patient:innen nennen auf dem Sperrbildschirm weder Praxis noch
  Ärztin/Arzt noch Uhrzeit.
- **Automatische Löschung:** Termine samt Kontaktdaten werden 12 Monate nach dem Termin gelöscht.
- **Kein Tracking:** Das Dashboard lädt keine fremden Skripte oder Schriften und erhebt keine Nutzungsstatistik.
- Vor dem Start schließen wir mit Ihnen eine Pilot-Vereinbarung einschließlich Datenschutzregelung ab.

## Fairness

Bezahlen verschafft Patient:innen keinen Vorrang. Es gibt für Patient:innen ein freiwilliges Abo
(„MedNow Plus“) mit Komfortfunktionen, z. B. mehreren Termin-Alarmen gleichzeitig. Frei werdende Termine gehen
aber an alle in derselben Reihenfolge – nach dem Zeitpunkt, zu dem der Termin-Alarm gesetzt wurde – und mit
derselben Reservierungszeit von 10 Minuten. Auch Praxen können keine bessere Platzierung kaufen: Die Suche
sortiert nach Verfügbarkeit und Entfernung.

## Kontakt

Gern zeigen wir Ihnen vorab die Demo des Praxis-Dashboards mit einer fiktiven Praxis.

- [PLATZHALTER: Name, Funktion]
- [PLATZHALTER: E-Mail] · [PLATZHALTER: Telefon]
- [PLATZHALTER: Anschrift des Betreibers]
