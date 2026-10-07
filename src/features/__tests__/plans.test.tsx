import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { HEALTH_CONSENT_VERSION } from '@/data/repository';
import { PlansScreen } from '@/features/plans/PlansScreen';
import { WaitlistScreen } from '@/features/waitlist/WaitlistScreen';
import { createTestRepository, renderWithProviders } from '@/test/render';

import { mockParams, mockRouter } from '../../../jest.setup';

const CENTER = { lat: 50.5558, lng: 9.6808 };

async function practiceIds(repository: ReturnType<typeof createTestRepository>) {
  const results = await repository.search(
    {
      center: CENTER,
      radiusKm: 10,
      window: 'week',
      specialtyIds: [],
      languages: [],
      accessibility: [],
      insurance: 'any',
      videoOnly: false,
      text: '',
    },
    new Date(),
  );
  return results.map((r) => r.practice.id);
}

describe('Abo-Grenzen (Demo-Modus, gleiche Regeln wie der Server)', () => {
  it('kostenlos: 1 Alarm, keine 60 Tage, Ich + 1 Person', async () => {
    const repo = createTestRepository();
    await repo.grantConsent('health_data', HEALTH_CONSENT_VERSION);
    const [a, b] = await practiceIds(repo);
    await repo.joinWaitlist(
      { target: { kind: 'practice', practiceId: a! }, days: 7, maxDistanceKm: 10 },
      CENTER,
    );
    await expect(
      repo.joinWaitlist(
        { target: { kind: 'practice', practiceId: b! }, days: 7, maxDistanceKm: 10 },
        CENTER,
      ),
    ).rejects.toMatchObject({ code: 'plan_limit' });
    await expect(
      repo.joinWaitlist(
        { target: { kind: 'practice', practiceId: b! }, days: 60, maxDistanceKm: 10 },
        CENTER,
      ),
    ).rejects.toMatchObject({ code: 'plan_limit' });
    await repo.addDependent('Mia', 'child_6_12');
    await expect(repo.addDependent('Ben', 'child_0_5')).rejects.toMatchObject({
      code: 'plan_limit',
    });
  });

  it('Plus (Demo-Kauf): mehrere Alarme mit 60 Tagen; Familie: 5 Profile', async () => {
    const repo = createTestRepository();
    await repo.grantConsent('health_data', HEALTH_CONSENT_VERSION);
    await repo.demoPurchase('mednow_plus_pass_30d');
    expect((await repo.getPlan()).plan).toBe('plus');
    const [a, b] = await practiceIds(repo);
    for (const id of [a!, b!]) {
      await repo.joinWaitlist(
        { target: { kind: 'practice', practiceId: id }, days: 60, maxDistanceKm: 10 },
        CENTER,
      );
    }
    expect((await repo.listWaitlist()).length).toBe(2);
    await repo.demoPurchase('mednow_family_yearly');
    for (const name of ['A', 'B', 'C', 'D']) await repo.addDependent(name, 'child_0_5');
    await expect(repo.addDependent('E', 'child_0_5')).rejects.toMatchObject({ code: 'plan_limit' });
  });
});

describe('Bezahlseite', () => {
  it('Gesamtpreise, nichts vorausgewählt, „Jetzt nicht“, Fairness-Hinweis', async () => {
    mockParams.current = { reason: 'alarms' };
    await renderWithProviders(<PlansScreen />, { repository: createTestRepository() }).result;
    expect(await screen.findByText('4,99 € einmalig')).toBeTruthy();
    expect(screen.getByText('29,99 € pro Jahr')).toBeTruthy();
    expect(screen.getByText('44,99 € pro Jahr')).toBeTruthy();
    expect(screen.getByText(/keinen Vorrang/)).toBeTruthy();
    expect(screen.getByTestId('plans-not-now')).toBeTruthy();
    expect(screen.getByText(/Es wird nichts berechnet/)).toBeTruthy();
    for (const id of ['mednow_plus_pass_30d', 'mednow_plus_yearly', 'mednow_family_yearly']) {
      expect(screen.getByTestId(`buy-${id}`).props.accessibilityState?.selected).toBeFalsy();
    }
  });

  it('Familien-Anlass zeigt nur Familie', async () => {
    mockParams.current = { reason: 'profiles' };
    await renderWithProviders(<PlansScreen />, { repository: createTestRepository() }).result;
    expect(await screen.findByTestId('buy-mednow_family_yearly')).toBeTruthy();
    expect(screen.queryByTestId('buy-mednow_plus_pass_30d')).toBeNull();
  });

  it('Demo-Kauf schaltet frei und schließt die Seite', async () => {
    mockParams.current = { reason: 'overview' };
    const repository = createTestRepository();
    await renderWithProviders(<PlansScreen />, { repository }).result;
    await fireEvent.press(await screen.findByTestId('buy-mednow_plus_yearly'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect((await repository.getPlan()).plan).toBe('plus');
  });
});

describe('Termin-Alarm an der Grenze', () => {
  it('zeigt „Bisherigen Alarm ersetzen“ gleichwertig zu Plus – Ersetzen funktioniert', async () => {
    const repository = createTestRepository();
    await repository.grantConsent('health_data', HEALTH_CONSENT_VERSION);
    const [a, b] = await practiceIds(repository);
    await repository.joinWaitlist(
      { target: { kind: 'practice', practiceId: a! }, days: 7, maxDistanceKm: 10 },
      CENTER,
    );
    mockParams.current = { practiceId: b! };
    await renderWithProviders(<WaitlistScreen />, { repository }).result;
    // Einwilligung und bestehende Alarme sind geladen
    await waitFor(() => expect(screen.queryByTestId('consent-checkbox')).toBeNull());
    await fireEvent.press(await screen.findByTestId('join-waitlist'));
    expect(await screen.findByTestId('alarm-limit')).toBeTruthy();
    expect(screen.getByTestId('alarm-see-plus')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('alarm-replace'));
    await waitFor(async () => {
      const list = await repository.listWaitlist();
      expect(list.map((w) => (w.target.kind === 'practice' ? w.target.practiceId : null))).toEqual([
        b,
      ]);
    });
  });
});
