/**
 * Druck-/Versandmappen als PDF aus den Markdown-Unterlagen:
 *   praxis-mappe.pdf        Infoblatt + Datenblatt (für Pilotpraxen)
 *   kanzlei-unterlagen.pdf  offene Rechtsfragen + alle Entwürfe (für die anwaltliche Prüfung)
 *   vorsorge-pruefbogen.pdf Prüfbogen (für die ärztliche Prüfung)
 *
 *   KONTAKT_NAME=… KONTAKT_EMAIL=… KONTAKT_TELEFON=… KONTAKT_ANSCHRIFT=… \
 *   CHROMIUM_PATH=/pfad/zu/chrome npx tsx scripts/build-print-docs.ts [Ausgabeordner]
 *
 * Die KONTAKT_*-Werte ersetzen die gleichnamigen Platzhalter; übrige Platzhalter bleiben gelb markiert.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { fillContact, renderMarkdown } from './build-website';

const ROOT = join(__dirname, '..');

export const BUNDLES: Record<string, { title: string; files: string[] }> = {
  'praxis-mappe': {
    title: 'Pilotphase – Unterlagen für Praxen',
    files: ['docs/pilot/praxis-infoblatt.md', 'docs/pilot/datenblatt-praxis.md'],
  },
  'kanzlei-unterlagen': {
    title: 'Rechtstexte – Unterlagen zur Prüfung',
    files: [
      'docs/legal/README.md',
      'docs/legal/datenschutz.md',
      'docs/legal/nutzungsbedingungen.md',
      'docs/legal/impressum.md',
      'docs/pilot/praxis-vereinbarung.md',
      'docs/legal-checklist.md',
    ],
  },
  'vorsorge-pruefbogen': {
    title: 'Prüfbogen Vorsorge-Inhalte',
    files: ['docs/vorsorge-pruefbogen.md'],
  },
};

const CSS = `
@page { size: A4; margin: 18mm 16mm 20mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #14211F; margin: 0; }
h1 { font-size: 20pt; line-height: 1.2; color: #0F766E; margin: 0 0 6pt; }
h2 { font-size: 13.5pt; margin: 16pt 0 4pt; break-after: avoid; }
h3 { font-size: 11.5pt; margin: 12pt 0 3pt; break-after: avoid; }
p, li { orphans: 3; widows: 3; }
a { color: #0F766E; }
blockquote { margin: 6pt 0 10pt; padding: 6pt 10pt; background: #DDF1EE; border-radius: 6pt; }
blockquote p { margin: 2pt 0; }
mark { background: #FDEFD3; padding: 0 2pt; border-radius: 3pt; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0; font-size: 9.5pt; break-inside: auto; }
tr { break-inside: avoid; }
th, td { border: 0.6pt solid #B8C7C3; padding: 4pt 6pt; text-align: left; vertical-align: top; }
th { background: #EEF3F1; }
td:empty::after { content: "\\00a0"; }
code { font: 9pt ui-monospace, Menlo, monospace; background: #EEF3F1; padding: 0 3pt; border-radius: 3pt; }
pre { white-space: pre-wrap; background: #EEF3F1; padding: 6pt; border-radius: 4pt; }
section.doc + section.doc { break-before: page; }
.cover { margin-bottom: 14pt; padding-bottom: 8pt; border-bottom: 1pt solid #DCE4E1; color: #4A5A57; font-size: 9.5pt; }
`;

export function bundleHtml(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const bundle = BUNDLES[name];
  if (!bundle) throw new Error(`Unbekannte Mappe: ${name}`);
  const docs = bundle.files
    .map(
      (f) =>
        `<section class="doc">${renderMarkdown(fillContact(readFileSync(join(ROOT, f), 'utf8'), env))}</section>`,
    )
    .join('\n');
  const date = new Date().toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${bundle.title}</title><style>${CSS}</style></head>
<body><div class="cover">${bundle.title} · Stand ${date}</div>${docs}</body></html>`;
}

async function main() {
  const out = process.argv[2] ?? join(ROOT, 'dist-print');
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    for (const name of Object.keys(BUNDLES)) {
      const page = await browser.newPage();
      await page.setContent(bundleHtml(name), { waitUntil: 'load' });
      await page.pdf({
        path: join(out, `${name}.pdf`),
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate:
          '<div style="font-size:8pt;color:#4A5A57;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
        margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
      });
      await page.close();
      console.log(`${name}.pdf`);
    }
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
