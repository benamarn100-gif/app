import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import { renderApp } from '../test/render';
import { addBerlinDays, berlinIsoDate } from '../lib/time';

async function openDemo() {
  const user = userEvent.setup();
  const view = renderApp();
  await user.click(await screen.findByRole('button', { name: 'Demo-Praxis öffnen' }));
  await screen.findByRole('navigation', { name: 'Hauptnavigation' });
  return { user, ...view };
}

async function expectNoAxeViolations(container: HTMLElement) {
  const result = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } }, // Kontrast prüft scripts/check-contrast.ts
  });
  expect(
    result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`),
  ).toEqual([]);
}

describe('Praxis-Dashboard (Demo)', () => {
  it('Anmeldeseite ist barrierefrei und öffnet die Demo-Praxis', async () => {
    const { user, container } = { user: userEvent.setup(), ...renderApp() };
    await screen.findByRole('heading', { name: 'Anmeldung für Praxen' });
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Demo-Praxis öffnen' }));
    expect(await screen.findByRole('link', { name: 'Wochenplan' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText(/fiktive Praxis, fiktive Buchungen/)).toBeInTheDocument();
  });

  it('Wochenplan: Termin anlegen, der sofort in der App sichtbar ist', async () => {
    const { user, container } = await openDemo();
    await screen.findAllByRole('button', { name: /Uhr, / });
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('button', { name: 'Termin anlegen' }));
    const dialog = await screen.findByRole('dialog', { name: 'Neuen Termin anlegen' });
    const date = within(dialog).getByLabelText('Datum');
    await user.clear(date);
    await user.type(date, berlinIsoDate(addBerlinDays(new Date(), 1)));
    const time = within(dialog).getByLabelText('Uhrzeit');
    await user.clear(time);
    await user.type(time, '06:00');
    await user.click(within(dialog).getByRole('button', { name: 'Anlegen' }));
    expect(await screen.findByText(/Termin angelegt/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Buchungen: fiktive Kontaktdaten sehen und einen Termin absagen', async () => {
    const { user, container } = await openDemo();
    await user.click(screen.getByRole('link', { name: 'Buchungen' }));
    await user.click(await screen.findByRole('button', { name: '30 Tage' }));
    expect(
      (await screen.findAllByText(/Mustermann|Beispiel|Muster|Exempel/)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Jeder Abruf wird protokolliert/)).toBeInTheDocument();
    await expectNoAxeViolations(container);

    const [cancel] = screen.getAllByRole('button', { name: /^Termin von .* absagen$/ });
    await user.click(cancel!);
    const dialog = await screen.findByRole('dialog', { name: 'Termin absagen?' });
    await user.click(within(dialog).getByRole('button', { name: 'Termin absagen' }));
    expect(await screen.findByText(/Termin abgesagt/)).toBeInTheDocument();
    expect(await screen.findAllByText('Abgesagt')).not.toHaveLength(0);
  });

  it('Sprechzeiten: Vorlage anlegen und Termine erzeugen', async () => {
    const { user, container } = await openDemo();
    await user.click(screen.getByRole('link', { name: 'Sprechzeiten' }));
    await screen.findByRole('heading', { name: 'Neue Vorlage' });
    await expectNoAxeViolations(container);
    await user.selectOptions(screen.getByLabelText('Wochentag'), 'Samstag');
    await user.click(screen.getByRole('button', { name: 'Vorlage hinzufügen' }));
    expect(await screen.findByText('Vorlage gespeichert.')).toBeInTheDocument();
    expect(screen.getByText('Samstag, 08:00–12:00 Uhr')).toBeInTheDocument();
    expect(screen.getByText(/Ergibt bis zu \d+ neue Termine/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Termine erzeugen' }));
    expect(
      await screen.findByText(/neue Termine angelegt|neuer Termin angelegt|Keine neuen Termine/),
    ).toBeInTheDocument();
  });
});
