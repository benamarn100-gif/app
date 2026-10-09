/**
 * Erzeugt docs/vorsorge-pruefbogen.md aus dem Code (src/domain/checkups.ts + Texte in de.json),
 * damit die ärztliche Prüfung genau das sieht, was die App zeigt.
 *
 *   npx tsx scripts/generate-vorsorge-pruefbogen.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CHECKUPS, type Checkup } from '../src/domain/checkups';
import de from '../src/i18n/locales/de.json';

type Item = { title: string; who: string; often: string; about: string };
const texts = de.checkups as unknown as Record<string, string> & { items: Record<string, Item> };

const AUDIENCE: Record<Checkup['audience'], string> = {
  all: 'alle (Abschnitt „Für alle“)',
  women: 'Frauen (Abschnitt „Für Frauen“)',
  men: 'Männer (Abschnitt „Für Männer“)',
};

const months = (m: number) =>
  `${m} Monate${m % 12 === 0 ? ` (= ${m / 12} Jahr${m / 12 > 1 ? 'e' : ''})` : ''}`;

function interval(c: Checkup): string {
  if (c.intervalMonths === null) return 'einmalig (nach „Erledigt“ keine weitere Erinnerung)';
  const base = months(c.intervalMonths);
  return c.intervalFrom
    ? `${base}; ab ${c.intervalFrom.minAge} Jahren ${months(c.intervalFrom.months)} (in der Altersgruppe 18–39 gilt im Zweifel der kürzere Abstand)`
    : base;
}

/** Recherche zu den beim Erzeugen aufgefallenen Fragen – Stand 09.10.2026, ärztlich zu bestätigen. */
const RESEARCH = `## Recherche vorab (Stand 09.10.2026)

Die folgenden Punkte sind mit öffentlichen Quellen vorgeprüft und – wo eindeutig – bereits in der App
umgesetzt. **Bitte trotzdem bestätigen oder korrigieren.**

| Thema | Ergebnis der Recherche | In der App | Quelle |
| --- | --- | --- | --- |
| Gebärmutterhals | 20–34 jährlich Pap-Abstrich, ab 35 alle 3 Jahre Ko-Test (HPV + Pap) | **angepasst:** ab 35 Erinnerung alle 36 Monate (Altersgruppe 18–39 bleibt bei 12) | G-BA, oKFE-Richtlinie, Versicherteninformationen |
| Darmkrebs | seit 04/2025 für Frauen und Männer ab 50: Stuhltest alle 2 Jahre **oder** zwei Darmspiegelungen im Abstand von 10 Jahren | unverändert – stimmt | G-BA-Pressemitteilung, Bundesgesundheitsministerium |
| Lungenkrebs | Niedrigdosis-CT seit 04/2026 für (ehemals) starke Raucherinnen und Raucher, 50–75, mind. 25 Jahre geraucht und 15 Packungsjahre; jährlich | **neu aufgenommen** (Voraussetzungen prüft die Hausarztpraxis) | G-BA, Lungenkrebs-Früherkennung |
| Chlamydien | Frauen bis 25 jährlich | **neu aufgenommen**, in der App ab 18 (nicht in Kinder-/Jugendprofilen) | Bundesgesundheitsministerium, Verbraucherzentrale |
| Check-up | 18–34 einmal, ab 35 alle 3 Jahre; ab 35 einmalig Hepatitis-B/C-Screening | Hepatitis-Hinweis **ergänzt**; Erinnerung weiterhin alle 36 Monate | G-BA-Gesundheitsuntersuchungs-Richtlinie, Verbraucherzentrale |

## Offene Fragen an die prüfende Ärztin / den prüfenden Arzt

1. **Check-up unter 35:** Nach „Erledigt“ erinnert die App nach 36 Monaten – auch wer z. B. mit 20 den
   einmaligen Check-up gemacht hat. Soll unter 35 nach „Erledigt“ keine Wiederholung kommen?
2. **U-Untersuchungen:** Die App erinnert alle 3 Monate (feste Zahl), die Zeiträume stehen im gelben Heft.
   Reicht das, oder sollen die Zeiträume U1–U9 einzeln hinterlegt werden?
3. **Chlamydien ab 18:** Der Anspruch besteht auch unter 18. Ist es richtig, den Hinweis in
   Jugendprofilen (die Eltern verwalten) nicht zu zeigen?
4. **Lungenkrebs:** Ist der Hinweis auf die Voraussetzungen ausreichend und neutral formuliert?
5. **Vollständigkeit:** Fehlt eine Leistung der gesetzlichen Krankenversicherung, die hier erwartet würde?
`;

export function buildPruefbogen(): string {
  const out: string[] = [];
  out.push('# Prüfbogen Vorsorge-Inhalte\n');
  out.push(
    '> Stand: 09.10.2026. Für die fachliche Prüfung durch eine Ärztin oder einen Arzt. Erzeugt aus dem Code ' +
      '(`src/domain/checkups.ts`, Texte `checkups.*` in `src/i18n/locales/de.json`) mit ' +
      '`scripts/generate-vorsorge-pruefbogen.ts` – so zeigt es die App.\n',
  );
  out.push('## Worum es geht\n');
  out.push(
    'Die App zeigt unter **Profil → Vorsorge** Früherkennungs- und Vorsorgeuntersuchungen, die die gesetzliche ' +
      'Krankenversicherung übernimmt. Nutzerinnen und Nutzer können sich **selbst** eine Erinnerung setzen. Die App ' +
      'gibt **keine Empfehlung** und wertet nichts aus. Erinnerungen werden nur auf dem Gerät gespeichert; die ' +
      `Mitteilung nennt keine Untersuchung („${texts.notificationBody}“).\n`,
  );
  out.push(
    'Angezeigt wird, was zur angegebenen **Altersgruppe** passt (ohne Angabe: alle Angebote für Erwachsene). Das ' +
      'Geschlecht wird nicht abgefragt; geschlechtsspezifische Angebote stehen in eigenen Abschnitten. Nach ' +
      '„Erledigt“ setzt die App die nächste Erinnerung im unten genannten Abstand.\n',
  );
  out.push('**Texte, die die App immer zeigt (wörtlich):**\n');
  for (const k of ['intro', 'disclaimer', 'consentBody', 'notificationBody'])
    out.push(`- \`${k}\`: „${texts[k]}“`);
  out.push('\n☐ korrekt ☐ ändern zu: ______________________________________________\n');
  out.push(RESEARCH);
  out.push('## Untersuchungen\n');
  CHECKUPS.forEach((c, i) => {
    const it = texts.items[c.id]!;
    const age = c.maxAge !== null ? `${c.minAge}–${c.maxAge} Jahre` : `ab ${c.minAge} Jahren`;
    out.push(`### ${i + 1}. ${it.title} (\`${c.id}\`)\n`);
    out.push('| | In der App | Prüfung |');
    out.push('| --- | --- | --- |');
    out.push(`| Name | ${it.title} | ☐ korrekt ☐ ändern: ______ |`);
    out.push(`| „Wer“ (Text) | ${it.who} | ☐ korrekt ☐ ändern: ______ |`);
    out.push(`| „Wie oft“ (Text) | ${it.often} | ☐ korrekt ☐ ändern: ______ |`);
    out.push(`| Beschreibung | ${it.about} | ☐ korrekt ☐ ändern: ______ |`);
    out.push(
      `| Angezeigt für (Code) | ${AUDIENCE[c.audience]}, ${age} | ☐ korrekt ☐ ändern: ______ |`,
    );
    out.push(`| Abstand nächste Erinnerung (Code) | ${interval(c)} | ☐ korrekt ☐ ändern: ______ |`);
    out.push('');
  });
  out.push('## Allgemeine Fragen\n');
  out.push(
    '- Ist der Hinweis „Keine medizinische Beratung …“ ausreichend und gut sichtbar formuliert?',
  );
  out.push('- Gibt es Formulierungen, die als Empfehlung missverstanden werden könnten?');
  out.push('- Weitere Anmerkungen: ______________________________________________\n');
  out.push('## Prüfung\n');
  out.push('Name, Fachrichtung: ______________________________\n');
  out.push('Datum: ______________ Unterschrift: ______________________________');
  return out.join('\n') + '\n';
}

if (require.main === module) {
  const file = join(__dirname, '..', 'docs', 'vorsorge-pruefbogen.md');
  writeFileSync(file, buildPruefbogen());
  console.log(`Prüfbogen → ${file} (${CHECKUPS.length} Untersuchungen)`);
}
