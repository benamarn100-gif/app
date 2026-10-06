import { parseEnv } from '@/config/env';

import {
  clearMeasurements,
  loadMeasurements,
  markInteractive,
  median,
  resetStartupForTests,
} from '../startup';

// jest.mock wird vor die Importe gehoben: Die Messung sieht den Diagnose-Modus.
jest.mock('@/config/env', () => {
  const actual = jest.requireActual<typeof import('@/config/env')>('@/config/env');
  return { ...actual, env: { ...actual.env, diagnostics: true } };
});

describe('Startzeit-Messung', () => {
  beforeEach(async () => {
    resetStartupForTests();
    await clearMeasurements();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('misst nur den ersten Aufruf je Kaltstart und speichert ihn', async () => {
    const first = markInteractive('home');
    expect(first).toMatchObject({ screen: 'home' });
    expect(first!.jsToInteractiveMs).toBeGreaterThanOrEqual(0);
    expect(markInteractive('onboarding')).toBeNull();
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/^\[startup\] \{.*"screen":"home"/),
    );

    await new Promise((resolve) => setImmediate(resolve));
    const stored = await loadMeasurements();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(first);
  });

  it('berechnet den Median', () => {
    expect(median([])).toBeNull();
    expect(median([900, 300, 600])).toBe(600);
    expect(median([400, 100, 300, 200])).toBe(250);
  });

  it('Diagnose nur mit EXPO_PUBLIC_DIAGNOSTICS=1', () => {
    expect(parseEnv({}).diagnostics).toBe(false);
    expect(parseEnv({ EXPO_PUBLIC_DIAGNOSTICS: '0' }).diagnostics).toBe(false);
    expect(parseEnv({ EXPO_PUBLIC_DIAGNOSTICS: '1' }).diagnostics).toBe(true);
  });
});
