import { Alert } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { CheckupsScreen } from '@/features/checkups/CheckupsScreen';
import { useCheckups } from '@/state/checkups';
import { usePreferences } from '@/state/preferences';
import { createTestRepository, renderWithProviders } from '@/test/render';

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

  it('speichert erst nach Einwilligung – nur auf dem Gerät', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style !== 'cancel')?.onPress?.();
    });
    await renderWithProviders(<CheckupsScreen />, { repository: createTestRepository() }).result;
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
    await renderWithProviders(<CheckupsScreen />, { repository: createTestRepository() }).result;
    await fireEvent.press(await screen.findByTestId('checkup-remind-checkup'));
    await fireEvent.press(screen.getByTestId('checkup-remind-checkup-36'));
    expect(useCheckups.getState().consentAt).toBeNull();
    expect(useCheckups.getState().reminders).toEqual({});
  });
});
