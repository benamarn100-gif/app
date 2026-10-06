import { screen } from '@testing-library/react-native';

import { DiagnosticsScreen } from '@/features/profile/DiagnosticsScreen';
import { createTestRepository, renderWithProviders } from '@/test/render';

jest.mock('@/config/env', () => {
  const actual = jest.requireActual<typeof import('@/config/env')>('@/config/env');
  return { ...actual, env: { ...actual.env, diagnostics: true } };
});

// Nach dem Mock laden, damit die Messung den Diagnose-Modus sieht.
const startup = jest.requireActual<typeof import('@/lib/startup')>('@/lib/startup');

describe('Diagnose-Seite (Testversion)', () => {
  beforeEach(async () => {
    startup.resetStartupForTests();
    await startup.clearMeasurements();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('zeigt Build-Angaben und Bedienungshilfen als je eine Ansage', async () => {
    await renderWithProviders(<DiagnosticsScreen />, { repository: createTestRepository() }).result;
    expect(await screen.findByLabelText('Daten: Demo-Daten auf dem Gerät')).toBeTruthy();
    expect(screen.getByLabelText('Letzter Kaltstart: Noch keine Messung')).toBeTruthy();
    expect(screen.getByLabelText(/^Screenreader: (An|Aus)$/)).toBeTruthy();
    expect(screen.getByLabelText(/^Schriftgröße: \d+ %$/)).toBeTruthy();
  });

  it('zeigt die gemessene Startzeit', async () => {
    const measurement = startup.markInteractive('home');
    await new Promise((resolve) => setImmediate(resolve));
    await renderWithProviders(<DiagnosticsScreen />, { repository: createTestRepository() }).result;
    expect(
      await screen.findByLabelText(`Letzter Kaltstart: ${measurement!.jsToInteractiveMs} ms`),
    ).toBeTruthy();
    expect(screen.getByLabelText(/^Median \(1 Messung\): \d+ ms$/)).toBeTruthy();
    expect(screen.getByText('Messwerte löschen')).toBeTruthy();
  });
});
