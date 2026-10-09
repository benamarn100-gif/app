import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildWebsite, fillContact, renderMarkdown } from '../build-website';

describe('Webseite aus docs/legal', () => {
  it('übernimmt kein rohes HTML aus den Texten', () => {
    const html = renderMarkdown(
      '# Titel\n\n<script>alert(1)</script>\n\nText <img src=x onerror=alert(1)>',
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('<h1>Titel</h1>');
  });

  it('markiert Platzhalter sichtbar', () => {
    expect(renderMarkdown('Name: [PLATZHALTER: Name des Betreibers]')).toContain(
      '<mark>[PLATZHALTER: Name des Betreibers]</mark>',
    );
  });

  it('füllt nur die bekannten Betreiber-Platzhalter aus der Umgebung', () => {
    const md = '[PLATZHALTER: Name], [PLATZHALTER: Anschrift] · [PLATZHALTER: USt-IdNr.]';
    expect(
      fillContact(md, { KONTAKT_NAME: 'Erika Muster', KONTAKT_ANSCHRIFT: 'Weg 1, 12345 Ort' }),
    ).toBe('Erika Muster, Weg 1, 12345 Ort · [PLATZHALTER: USt-IdNr.]');
  });

  it('baut alle Seiten, fehlende Texte als Platzhalter', () => {
    const legal = mkdtempSync(join(tmpdir(), 'legal-'));
    writeFileSync(join(legal, 'impressum.md'), '# Impressum\n\nAngaben folgen.');
    const out = join(mkdtempSync(join(tmpdir(), 'site-')), 'site');
    mkdirSync(out);
    const { missing } = buildWebsite(out, { legalDir: legal, supportEmail: 'hilfe@example.org' });
    expect(missing).toEqual(['datenschutz.md', 'nutzungsbedingungen.md']);
    expect(readFileSync(join(out, 'impressum', 'index.html'), 'utf8')).toContain('Angaben folgen.');
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain('mailto:hilfe@example.org');
    expect(readFileSync(join(out, '.htaccess'), 'utf8')).toContain('frame-ancestors');
  });
});
