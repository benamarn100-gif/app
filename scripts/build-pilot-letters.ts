/**
 * Serienbriefe an mögliche Pilotpraxen (DIN 5008 Form B, für Fensterumschläge DL/C5/6).
 *
 *   KONTAKT_NAME=… KONTAKT_ANSCHRIFT="Straße 1, 12345 Ort" KONTAKT_TELEFON=… KONTAKT_EMAIL=… \
 *   CHROMIUM_PATH=/pfad/zu/chrome npx tsx scripts/build-pilot-letters.ts praxen.json briefe.pdf
 *
 * praxen.json: [{ name, street, plz, city, specialty, nearby? }] – z. B. aus dem Praxisverzeichnis.
 * Die Absenderangaben kommen nur aus der Umgebung, nie aus dem Repository.
 *
 * Bewusst Brief statt E-Mail: Werbung per E-Mail ist ohne vorherige Einwilligung auch gegenüber
 * Praxen unzulässig (§ 7 Abs. 2 Nr. 2 UWG). Der Brief informiert zugleich darüber, dass die Praxis
 * im Verzeichnis steht und wie sie das ablehnen kann.
 */
import { readFileSync } from 'node:fs';

import { chromium } from 'playwright-core';

export type LetterPractice = {
  name: string;
  street: string;
  plz: string;
  city: string;
  /** Fachrichtung im Fließtext, z. B. „Allgemeinmedizin“ */
  specialty: string;
  /** In Reichweite für einen Besuch vor Ort (sonst Telefon/Video) */
  nearby?: boolean;
};

export type Sender = { name: string; address: string; phone: string; email: string };

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export function senderFromEnv(env: Partial<Record<string, string>>): Sender {
  const sender = {
    name: env.KONTAKT_NAME ?? '',
    address: env.KONTAKT_ANSCHRIFT ?? '',
    phone: env.KONTAKT_TELEFON ?? '',
    email: env.KONTAKT_EMAIL ?? '',
  };
  const missing = Object.entries(sender)
    .filter(([, v]) => !v.trim())
    .map(([k]) => k);
  if (missing.length) throw new Error(`Absender fehlt: ${missing.join(', ')} (KONTAKT_*)`);
  return sender;
}

/** Praxisnamen sind oft lang („Dr. med. A & Dr. med. B, Fachärzte für …“): für das Anschriftfeld kürzen. */
export function addressName(name: string): string[] {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (clean.length <= 42) return [clean];
  const cut = clean.lastIndexOf(' ', 42);
  const first = clean.slice(0, cut > 20 ? cut : 42).trim();
  const rest = clean.slice(first.length).trim();
  return [first, rest.length > 42 ? `${rest.slice(0, 41).trim()}…` : rest];
}

export function letterHtml(p: LetterPractice, sender: Sender, date: Date): string {
  const dateText = date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const meet = p.nearby
    ? 'telefonisch oder gern bei Ihnen in der Praxis'
    : 'telefonisch oder per Videogespräch';
  const recipient = [...addressName(p.name), p.street, `${p.plz} ${p.city}`];
  return `<section class="letter">
  <div class="sender-head"><strong>${esc(sender.name)}</strong><br>${esc(sender.address)}<br>${esc(sender.phone)} · ${esc(sender.email)}</div>
  <div class="window">
    <div class="return">${esc(sender.name)} · ${esc(sender.address)}</div>
    <div class="recipient">${recipient.map(esc).join('<br>')}</div>
  </div>
  <div class="date">${esc(dateText)}</div>
  <p class="subject">Kostenloser Pilot: freie Termine digital vergeben – ohne neue Software</p>
  <p>Sehr geehrte Damen und Herren,</p>
  <p>ich entwickle <strong>Terminlücke</strong>, eine App, mit der Patientinnen und Patienten in ganz Deutschland freie Arzttermine finden und direkt buchen können – ohne Werbung, Server in Frankfurt. Für den Start suche ich in ${esc(p.city)} Praxen für ${esc(p.specialty)}, die die App drei Monate lang kostenlos mit mir ausprobieren.</p>
  <ul>
    <li>Freie und kurzfristig frei gewordene Termine sehen Patientinnen und Patienten sofort. Wer wartet, bekommt einen frei werdenden Termin automatisch angeboten – in der Reihenfolge der Anmeldung.</li>
    <li>Buchungen kommen mit Name, Telefonnummer und Versicherungsart an. Das ersetzt einen Teil der Anrufe.</li>
    <li>Keine neue Software, keine Anbindung an Ihr Praxisverwaltungssystem: eine Webseite mit Zwei-Faktor-Anmeldung. Keine Kosten, keine Provision.</li>
  </ul>
  <p>Ich bräuchte etwa 30–45 Minuten für die Einrichtung, danach wenige Minuten pro Praxistag. Darf ich Ihnen das in 15 Minuten zeigen – ${meet}? Ich richte mich nach Ihren Sprechzeiten. Eine kurze Nachricht an ${esc(sender.email)} oder ${esc(sender.phone)} genügt.</p>
  <p class="note"><strong>Zu Ihrem Eintrag:</strong> Ihre Praxis ist in Terminlücke bereits mit Name, Adresse und – soweit bekannt – Telefonnummer, Website und Sprechzeiten verzeichnet, als „ohne Online-Termine“ (Quelle: OpenStreetMap, © OpenStreetMap-Mitwirkende, ODbL). Möchten Sie dort nicht erscheinen oder ist etwas falsch, genügt eine kurze Nachricht – ich entferne oder korrigiere den Eintrag umgehend.</p>
  <p>Mit freundlichen Grüßen</p>
  <p class="signature">${esc(sender.name)}</p>
  <p class="attachments">Anlagen: Infoblatt für Praxen, Datenblatt zur Einrichtung</p>
</section>`;
}

const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font: 10.5pt/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #14211F; }
.letter { position: relative; width: 210mm; height: 297mm; padding: 98mm 20mm 20mm 25mm; page-break-after: always; overflow: hidden; }
.letter:last-child { page-break-after: auto; }
.sender-head { position: absolute; top: 15mm; right: 20mm; text-align: right; font-size: 9pt; color: #4A5A57; }
.sender-head strong { color: #0F766E; font-size: 11pt; }
/* DIN 5008 Form B: Anschriftfeld 45 mm von oben, 20 mm von links, 85 × 45 mm */
.window { position: absolute; top: 45mm; left: 20mm; width: 85mm; height: 45mm; }
.return { font-size: 7pt; color: #4A5A57; border-bottom: 0.3pt solid #B8C7C3; padding-bottom: 1mm; margin-bottom: 3mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.recipient { font-size: 10.5pt; line-height: 1.35; }
.date { position: absolute; top: 90mm; right: 20mm; }
.subject { font-weight: 700; margin: 0 0 5mm; }
p { margin: 0 0 3mm; }
ul { margin: 0 0 3mm; padding-left: 5mm; }
li { margin-bottom: 1.5mm; }
.note { font-size: 9.5pt; background: #EEF3F1; padding: 2.5mm 3mm; border-radius: 2mm; }
.signature { margin-top: 8mm; }
.attachments { margin-top: 5mm; font-size: 9pt; color: #4A5A57; }
`;

export function lettersDocument(practices: LetterPractice[], sender: Sender, date: Date): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Briefe an Pilotpraxen</title><style>${CSS}</style></head><body>${practices
    .map((p) => letterHtml(p, sender, date))
    .join('\n')}</body></html>`;
}

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Aufruf: build-pilot-letters.ts praxen.json briefe.pdf');
  const practices = JSON.parse(readFileSync(input, 'utf8')) as LetterPractice[];
  const sender = senderFromEnv(process.env);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    const page = await browser.newPage();
    await page.setContent(lettersDocument(practices, sender, new Date()), { waitUntil: 'load' });
    await page.pdf({ path: output, format: 'A4', printBackground: true, preferCSSPageSize: true });
    console.log(`${practices.length} Briefe → ${output}`);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
