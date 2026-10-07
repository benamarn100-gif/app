import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { CheckupsScreen } from '@/features/checkups/CheckupsScreen';
import { useCheckups } from '@/state/checkups';
import { usePreferences } from '@/state/preferences';
import { createTestRepository, renderWithProviders } from '@/test/render';

import { mockRouter } from '../../../jest.setup';

/** Erinnerungen für sich selbst gibt es mit Plus (Übersicht bleibt kostenlos). */
async function plusRepository() {
  const repository = createTestRepository();
  await repository.demoPurchase('mednow_plus_yearly');
  return repository;
}

describe('Vorsorge', () => {
  beforeEach(() => {
    usePreferences.getState().set({ selfAgeGroup: 'adult_40_64' });
    useCheckups.getState().clear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('zeigt nur, was zur Altersgruppe passt (40–64)', async () => {
    await renderWithProviders(<CheckupsScreen />, { repository: createTestRepository() }).result;
    expect(await screen.findByTestId('checkup-skin')).toBeTruthy();
    expect(screen.getByTestId('checkup-prostate')).toBeTruthy();
    expect(screen.queryByTestId('checkup-uExams')).toBeNull();
    expect(screen.queryByTestId('checkup-aorta')).toBeNull();
  });

  it('kostenlos: Übersicht sichtbar, „Erinnern“ öffnet die Bezahlseite', async () => {
    await renderWithProviders(<CheckupsScreen />, { repository: createTestRepository() }).result;
    await screen.findByText(/Erinnern · Plus/, {}, { timeout: 3000 }).catch(() => undefined);
    await fireEvent.press(await screen.findByTestId('checkup-remind-skin'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/plans',
      params: { reason: 'checkups' },
    });
    expect(useCheckups.getState().reminders).toEqual({});
  });

  it('speichert erst nach Einwilligung – nur auf dem Gerät', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style !== 'cancel')?.onPress?.();
    });
    await renderWithProviders(<CheckupsScreen />, { repository: await plusRepository() }).result;
    await waitFor(() => expect(screen.queryAllByText(/· Plus/)).toHaveLength(0));
    await fireEvent.press(await screen.findByTestId('checkup-remind-skin'));
    await fireEvent.press(screen.getByTestId('checkup-remind-skin-24'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(useCheckups.getState().consentAt).not.toBeNull();
    expect(Object.keys(useCheckups.getState().reminders)).toEqual(['self:skin']);
    expect(await screen.findByTestId('checkup-done-skin')).toBeTruthy();
  });

  it('ohne Einwilligung wird nichts gespeichert', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'cancel')?.onPress?.();
    });
    await renderWithProviders(<CheckupsScreen />, { repository: await plusRepository() }).result;
    await waitFor(() => expect(screen.queryAllByText(/· Plus/)).toHaveLength(0));
    await fireEvent.press(await screen.findByTestId('checkup-remind-checkup'));
    await fireEvent.press(screen.getByTestId('checkup-remind-checkup-36'));
    expect(useCheckups.getState().consentAt).toBeNull();
    expect(useCheckups.getState().reminders).toEqual({});
  });
});
