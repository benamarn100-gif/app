import { screen } from '@testing-library/react-native';

import { parseMarkdown } from '@/components';
import { LegalScreen } from '@/features/profile/LegalScreen';
import { renderWithProviders } from '@/test/render';

import { mockParams } from '../../../jest.setup';

describe('Rechtstexte in der App', () => {
  it('liest Überschriften, Listen mit Fortsetzung, Unterpunkte, Zitate und Tabellen', () => {
    const blocks = parseMarkdown(
      [
        '# Titel',
        '',
        '> **ENTWURF** – prüfen.',
        '',
        '1. Erster Punkt',
        '   geht weiter.',
        '- Liste',
        '  - Unterpunkt',
        '',
        '| Funktion | Hinweis |',
        '| -------- | ------- |',
        '| Alarm    | lokal   |',
        '',
        'Absatz mit [Link](https://example.org)',
        'und zweiter Zeile.',
      ].join('\n'),
    );
    expect(blocks).toEqual([
      { kind: 'heading', level: 1, text: 'Titel' },
      { kind: 'quote', text: '**ENTWURF** – prüfen.' },
      { kind: 'item', text: 'Erster Punkt geht weiter.', depth: 0, marker: '1.' },
      { kind: 'item', text: 'Liste', depth: 0, marker: '•' },
      { kind: 'item', text: 'Unterpunkt', depth: 1, marker: '•' },
      { kind: 'table', header: ['Funktion', 'Hinweis'], rows: [['Alarm', 'lokal']] },
      { kind: 'paragraph', text: 'Absatz mit [Link](https://example.org) und zweiter Zeile.' },
    ]);
  });

  it('zeigt die vollständige Datenschutzerklärung statt eines Platzhalters', async () => {
    mockParams.current = { page: 'privacy' };
    await renderWithProviders(<LegalScreen />).result;
    expect(screen.getByTestId('legal-privacy')).toBeTruthy();
    expect(screen.getByText('Datenschutzerklärung')).toBeTruthy();
    expect(screen.getByText('Das Wichtigste in Kürze')).toBeTruthy();
    expect(screen.getByText(/7\. Angaben zu Praxen/)).toBeTruthy();
    // Entwurfshinweis bleibt sichtbar, bis die anwaltliche Prüfung erledigt ist
    expect(screen.getAllByText(/ENTWURF/).length).toBeGreaterThan(0);
  });

  it('Impressum aus derselben Quelle wie die Webseite', async () => {
    mockParams.current = { page: 'imprint' };
    await renderWithProviders(<LegalScreen />).result;
    expect(screen.getByText(/Angaben gemäß § 5 DDG/)).toBeTruthy();
    expect(screen.getAllByText(/\[PLATZHALTER: Name\]/).length).toBeGreaterThan(0);
  });
});
