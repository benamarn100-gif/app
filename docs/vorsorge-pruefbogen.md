# Prüfbogen Vorsorge-Inhalte

> Stand: 07.10.2026. Für die fachliche Prüfung durch eine Ärztin oder einen Arzt. Erzeugt aus dem Code (`src/domain/checkups.ts`, Texte `checkups.*` in `src/i18n/locales/de.json`) – so zeigt es die App.

## Worum es geht

Die App zeigt unter **Profil → Vorsorge** Früherkennungs- und Vorsorgeuntersuchungen, die die gesetzliche Krankenversicherung übernimmt. Nutzerinnen und Nutzer können sich **selbst** eine Erinnerung setzen. Die App gibt **keine Empfehlung** und wertet nichts aus. Erinnerungen werden nur auf dem Gerät gespeichert; die Mitteilung nennt keine Untersuchung („Eine Vorsorge steht an. Details in MedNow.“).

Angezeigt wird, was zur angegebenen **Altersgruppe** passt (ohne Angabe: alle Angebote für Erwachsene). Das Geschlecht wird nicht abgefragt; geschlechtsspezifische Angebote stehen in eigenen Abschnitten. Nach „Erledigt“ setzt die App die nächste Erinnerung im unten genannten Abstand.

**Texte, die die App immer zeigt (wörtlich):**

- `intro`: „Diese Früherkennungs- und Vorsorgeuntersuchungen übernimmt die gesetzliche Krankenversicherung. Wähle selbst, woran wir dich erinnern sollen.“
- `disclaimer`: „Keine medizinische Beratung. Ob und wann eine Untersuchung sinnvoll ist, besprich mit deiner Praxis. Stand 10/2026; private Versicherungen können abweichen.“
- `consentBody`: „Wir speichern nur, an welche Vorsorge du erinnert werden möchtest und wann – ausschließlich auf diesem Gerät, nicht auf unseren Servern. Mitteilungen nennen keine Untersuchung. Du kannst alles jederzeit löschen.“
- `notificationBody`: „Eine Vorsorge steht an. Details in MedNow.“

☐ korrekt ☐ ändern zu: ______________________________________________

## Untersuchungen

### 1. Gesundheits-Check-up (`checkup`)

|                                   | In der App                                                                              | Prüfung                    |
| --------------------------------- | --------------------------------------------------------------------------------------- | -------------------------- |
| Name                              | Gesundheits-Check-up                                                                    | ☐ korrekt ☐ ändern: ______ |
| „Wer“ (Text)                      | 18–34 Jahre einmal, ab 35 Jahren regelmäßig                                             | ☐ korrekt ☐ ändern: ______ |
| „Wie oft“ (Text)                  | ab 35 alle 3 Jahre                                                                      | ☐ korrekt ☐ ändern: ______ |
| Beschreibung                      | Hausärztliche Untersuchung mit Blutdruck, Blutwerten und Gespräch über Vorerkrankungen. | ☐ korrekt ☐ ändern: ______ |
| Angezeigt für (Code)              | alle (Abschnitt „Für alle“), ab 18 Jahren                                               | ☐ korrekt ☐ ändern: ______ |
| Abstand nächste Erinnerung (Code) | 36 Monate (= 3 Jahre)                                                                   | ☐ korrekt ☐ ändern: ______ |

### 2. Hautkrebs-Screening (`skin`)

|                                   | In der App                                                                  | Prüfung                    |
| --------------------------------- | --------------------------------------------------------------------------- | -------------------------- |
| Name                              | Hautkrebs-Screening                                                         | ☐ korrekt ☐ ändern: ______ |
| „Wer“ (Text)                      | ab 35 Jahren                                                                | ☐ korrekt ☐ ändern: ______ |
| „Wie oft“ (Text)                  | alle 2 Jahre                                                                | ☐ korrekt ☐ ändern: ______ |
| Beschreibung                      | Untersuchung der gesamten Haut, z. B. in der Hautarzt- oder Hausarztpraxis. | ☐ korrekt ☐ ändern: ______ |
| Angezeigt für (Code)              | alle (Abschnitt „Für alle“), ab 35 Jahren                                   | ☐ korrekt ☐ ändern: ______ |
| Abstand nächste Erinnerung (Code) | 24 Monate (= 2 Jahre)                                                       | ☐ korrekt ☐ ändern: ______ |

### 3. Zahnärztliche Kontrolle (`dental`)

|                                   | In der App                                                                      | Prüfung                    |
| --------------------------------- | ------------------------------------------------------------------------------- | -------------------------- |
| Name                              | Zahnärztliche Kontrolle                                                         | ☐ korrekt ☐ ändern: ______ |
| „Wer“ (Text)                      | Erwachsene                                                                      | ☐ korrekt ☐ ändern: ______ |
| „Wie oft“ (Text)                  | zweimal im Jahr (einmal je Halbjahr)                                            | ☐ korrekt ☐ ändern: ______ |
| Beschreibung                      | Regelmäßige Kontrollen im Bonusheft können den Zuschuss für Zahnersatz erhöhen. | ☐ korrekt ☐ ändern: ______ |
| Angezeigt für (Code)              | alle (Abschnitt „Für alle“), ab 18 Jahren                                       | ☐ korrekt ☐ ändern: ______ |
| Abstand nächste Erinnerung (Code) | 6 Monate                                                                        | ☐ korrekt ☐ ändern: ______ |

### 4. Darmkrebs-Früherkennung (`bowel`)

|                                   | In der App                                                                 | Prüfung                    |
| --------------------------------- | -------------------------------------------------------------------------- | -------------------------- |
| Name                              | Darmkrebs-Früherkennung                                                    | ☐ korrekt ☐ ändern: ______ |
| „Wer“ (Text)                      | ab 50 Jahren                                                               | ☐ korrekt ☐ ändern: ______ |
| „Wie oft“ (Text)                  | Stuhltest alle 2 Jahre oder zwei Darmspiegelungen im Abstand von 10 Jahren | ☐ korrekt ☐ ändern: ______ |
| Beschreibung                      | Welche Variante passt, besprichst du in der Praxis.                        | ☐ korrekt ☐ ändern: ______ |
| Angezeigt für (Code)              | alle (Abschnitt „Für alle“), ab 50 Jahren                                  | ☐ korrekt ☐ ändern: ______ |
| Abstand nächste Erinnerung (Code) | 24 Monate (= 2 Jahre)                                                      | ☐ korrekt ☐ ändern: ______ |

### 5. Gebärmutterhalskrebs-Früherkennung (`cervix`)

|                                   | In der App                                         | Prüfung                    |
| --------------------------------- | -------------------------------------------------- | -------------------------- |
| Name                              | Gebärmutterhalskrebs-Früherkennung                 | ☐ korrekt ☐ ändern: ______ |
| „Wer“ (Text)                      | ab 20 Jahren                                       | ☐ korrekt ☐ ändern: ______ |
| „Wie oft“ (Text)                  | jährlich; ab 35 alle 3 Jahre ein kombinierter Test | ☐ korrekt ☐ ändern: ______ |
| Beschreibung                      | Untersuchung in der Frauenarztpraxis.              | ☐ korrekt ☐ ändern: ______ |
| Angezeigt für (Code)              | Frauen (Abschnitt „Für Frauen“), ab 20 Jahren      | ☐ korrekt ☐ ändern: ______ |
| Abstand nächste Erinnerung (Code) | 12 Monate (= 1 Jahr)                               | ☐ korrekt ☐ ändern: ______ |

### 6. Mammographie-Screening (`breast`)

|                                   | In der App                                                                     | Prüfung                    |
| --------------------------------- | ------------------------------------------------------------------------------ | -------------------------- |
| Name                              | Mammographie-Screening                                                         | ☐ korrekt ☐ ändern: ______ |
| „Wer“ (Text)                      | 50–75 Jahre                                                                    | ☐ korrekt ☐ ändern: ______ |
| „Wie oft“ (Text)                  | alle 2 Jahre                                                                   | ☐ korrekt ☐ ändern: ______ |
| Beschreibung                      | Die Einladung kommt per Post von der zentralen Stelle des Screening-Programms. | ☐ korrekt ☐ ändern: ______ |
| Angezeigt für (Code)              | Frauen (Abschnitt „Für Frauen“), 50–75 Jahre                                   | ☐ korrekt ☐ ändern: ______ |
| Abstand nächste Erinnerung (Code) | 24 Monate (= 2 Jahre)                                                          | ☐ korrekt ☐ ändern: ______ |

### 7. Krebsfrüherkennung für Männer (`prostate`)

|                                   | In der App                                                                                        | Prüfung                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------- |
| Name                              | Krebsfrüherkennung für Männer                                                                     | ☐ korrekt ☐ ändern: ______ |
| „Wer“ (Text)                      | ab 45 Jahren                                                                                      | ☐ korrekt ☐ ändern: ______ |
| „Wie oft“ (Text)                  | jährlich                                                                                          | ☐ korrekt ☐ ändern: ______ |
| Beschreibung                      | Untersuchung der Prostata und der äußeren Genitalien, z. B. in der Urologie- oder Hausarztpraxis. | ☐ korrekt ☐ ändern: ______ |
| Angezeigt für (Code)              | Männer (Abschnitt „Für Männer“), ab 45 Jahren                                                     | ☐ korrekt ☐ ändern: ______ |
| Abstand nächste Erinnerung (Code) | 12 Monate (= 1 Jahr)                                                                              | ☐ korrekt ☐ ändern: ______ |

### 8. Ultraschall der Bauchschlagader (`aorta`)

|                                   | In der App                                                                  | Prüfung                    |
| --------------------------------- | --------------------------------------------------------------------------- | -------------------------- |
| Name                              | Ultraschall der Bauchschlagader                                             | ☐ korrekt ☐ ändern: ______ |
| „Wer“ (Text)                      | ab 65 Jahren                                                                | ☐ korrekt ☐ ändern: ______ |
| „Wie oft“ (Text)                  | einmalig                                                                    | ☐ korrekt ☐ ändern: ______ |
| Beschreibung                      | Früherkennung einer Erweiterung der Bauchschlagader (Bauchaortenaneurysma). | ☐ korrekt ☐ ändern: ______ |
| Angezeigt für (Code)              | Männer (Abschnitt „Für Männer“), ab 65 Jahren                               | ☐ korrekt ☐ ändern: ______ |
| Abstand nächste Erinnerung (Code) | einmalig (nach „Erledigt“ keine weitere Erinnerung)                         | ☐ korrekt ☐ ändern: ______ |

### 9. Kinder-Untersuchungen U1–U9 (`uExams`)

|                                   | In der App                                                                  | Prüfung                    |
| --------------------------------- | --------------------------------------------------------------------------- | -------------------------- |
| Name                              | Kinder-Untersuchungen U1–U9                                                 | ☐ korrekt ☐ ändern: ______ |
| „Wer“ (Text)                      | bis etwa 5½ Jahre                                                           | ☐ korrekt ☐ ändern: ______ |
| „Wie oft“ (Text)                  | nach Plan im gelben Kinder-Untersuchungsheft                                | ☐ korrekt ☐ ändern: ______ |
| Beschreibung                      | Die genauen Zeiträume stehen im Heft – die Erinnerung legst du selbst fest. | ☐ korrekt ☐ ändern: ______ |
| Angezeigt für (Code)              | alle (Abschnitt „Für alle“), 0–5 Jahre                                      | ☐ korrekt ☐ ändern: ______ |
| Abstand nächste Erinnerung (Code) | 3 Monate                                                                    | ☐ korrekt ☐ ändern: ______ |

### 10. Zahnärztliche Vorsorge für Kinder (`dentalChild`)

|                                   | In der App                                              | Prüfung                    |
| --------------------------------- | ------------------------------------------------------- | -------------------------- |
| Name                              | Zahnärztliche Vorsorge für Kinder                       | ☐ korrekt ☐ ändern: ______ |
| „Wer“ (Text)                      | ab dem 6. Lebensmonat bis 17 Jahre                      | ☐ korrekt ☐ ändern: ______ |
| „Wie oft“ (Text)                  | zweimal im Jahr                                         | ☐ korrekt ☐ ändern: ______ |
| Beschreibung                      | Bis 6 Jahre Früherkennung, danach Individualprophylaxe. | ☐ korrekt ☐ ändern: ______ |
| Angezeigt für (Code)              | alle (Abschnitt „Für alle“), 0–17 Jahre                 | ☐ korrekt ☐ ändern: ______ |
| Abstand nächste Erinnerung (Code) | 6 Monate                                                | ☐ korrekt ☐ ändern: ______ |

### 11. Jugenduntersuchung J1 (`j1`)

|                                   | In der App                                                                        | Prüfung                    |
| --------------------------------- | --------------------------------------------------------------------------------- | -------------------------- |
| Name                              | Jugenduntersuchung J1                                                             | ☐ korrekt ☐ ändern: ______ |
| „Wer“ (Text)                      | 12–14 Jahre                                                                       | ☐ korrekt ☐ ändern: ______ |
| „Wie oft“ (Text)                  | einmalig                                                                          | ☐ korrekt ☐ ändern: ______ |
| Beschreibung                      | Körperliche Untersuchung und Gespräch, z. B. in der Kinder- und Jugendarztpraxis. | ☐ korrekt ☐ ändern: ______ |
| Angezeigt für (Code)              | alle (Abschnitt „Für alle“), 12–14 Jahre                                          | ☐ korrekt ☐ ändern: ______ |
| Abstand nächste Erinnerung (Code) | einmalig (nach „Erledigt“ keine weitere Erinnerung)                               | ☐ korrekt ☐ ändern: ______ |

## Auffälligkeiten für die Prüfung

Beim Erzeugen aufgefallen – **Fragen, keine Bewertung**:

1. **Gesundheits-Check-up:** Der Text sagt „18–34 Jahre einmal, ab 35 alle 3 Jahre“. Die App setzt nach „Erledigt“ aber für alle ab 18 die nächste Erinnerung in 36 Monaten – auch bei 18- bis 34-Jährigen. Soll für unter 35-Jährige nach „Erledigt“ keine Wiederholung kommen?
2. **Gebärmutterhalskrebs-Früherkennung:** Der Text sagt „jährlich; ab 35 alle 3 Jahre ein kombinierter Test“. Die App erinnert aber für alle ab 20 jährlich (12 Monate). Soll ab 35 der Abstand 36 Monate sein?
3. **Darmkrebs-Früherkennung:** Der Text nennt „Stuhltest alle 2 Jahre“. Gilt das ab 50 durchgehend, oder gibt es eine Altersstufe mit jährlichem Test? Ist „zwei Darmspiegelungen im Abstand von 10 Jahren“ für Frauen und Männer ab 50 korrekt?
4. **U-Untersuchungen:** Die App erinnert alle 3 Monate (feste Zahl), die Zeiträume stehen im Heft. Ist das als einfache Erinnerung angemessen, oder sollen die U-Zeiträume einzeln hinterlegt werden?
5. **Vollständigkeit:** Fehlt eine Leistung, die die gesetzliche Krankenversicherung allgemein übernimmt und die hier erwartet würde (z. B. für Kinder/Jugendliche oder ab 65)?

## Allgemeine Fragen

- Ist der Hinweis „Keine medizinische Beratung …“ ausreichend und gut sichtbar formuliert?
- Gibt es Formulierungen, die als Empfehlung missverstanden werden könnten?
- Weitere Anmerkungen: ______________________________________________

## Prüfung

Name, Fachrichtung: ______________________________

Datum: ______________ Unterschrift: ______________________________
