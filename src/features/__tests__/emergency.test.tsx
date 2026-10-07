import { Linking } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { EmergencyScreen } from '@/features/emergency/EmergencyScreen';
import { createTestRepository, renderWithProviders } from '@/test/render';

describe('Notfall-Seite', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it('zeigt 112 zuerst und alle Hilfe-Nummern', async () => {
    await renderWithProviders(<EmergencyScreen />, { repository: createTestRepository() }).result;
    expect(await screen.findByText('Lebensgefahr: Notruf 112')).toBeTruthy();
    expect(screen.getByText('Ärztlicher Bereitschaftsdienst 116117')).toBeTruthy();
    expect(screen.getByText('Festnetz: 0800 00 22833 (kostenlos)')).toBeTruthy();
    expect(screen.getByText('Handy: 22833 (max. 69 ct/Min.)')).toBeTruthy();
    for (const n of ['0800 111 0 111', '0800 111 0 222', '116 123']) {
      expect(screen.getByText(n)).toBeTruthy();
    }
  });

  it('wählt die Nummern ohne Leerzeichen', async () => {
    await renderWithProviders(<EmergencyScreen />, { repository: createTestRepository() }).result;
    await fireEvent.press(await screen.findByTestId('emergency-call-112'));
    expect(Linking.openURL).toHaveBeenCalledWith('tel:112');
    await fireEvent.press(screen.getByText('Festnetz: 0800 00 22833 (kostenlos)'));
    expect(Linking.openURL).toHaveBeenCalledWith('tel:08000022833');
    await fireEvent.press(screen.getByTestId('emergency-pharmacy-search'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.aponet.de/apotheke/notdienstsuche');
  });
});
