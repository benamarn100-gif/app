import { Platform } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { Button } from '../Button';
import { Chip } from '../Chip';
import { useConfirm } from '../ConfirmDialog';
import { FreshnessLabel } from '../FreshnessLabel';
import { PracticeCard } from '../PracticeCard';
import { StatusBadge } from '../StatusBadge';
import { Text } from '../Text';
import { TextField } from '../TextField';
import { initialsOf } from '../Avatar';
import { cities } from '@/config/city';
import { generateDirectory } from '@/domain/seed/generator';
import type { PracticeAvailability } from '@/domain/types';
import { setNowOverride } from '@/lib/useNow';
import { renderWithProviders } from '@/test/render';

const NOW = new Date('2026-10-06T10:00:00Z'); // 12:00 Berlin

beforeAll(() => setNowOverride(NOW));
afterAll(() => setNowOverride(null));

describe('StatusBadge: Status nie nur über Farbe', () => {
  it.each([
    ['free', 'Frei'],
    ['few', 'Wenige frei'],
    ['booked', 'Ausgebucht'],
    ['unknown', 'Unbekannt'],
  ] as const)('%s zeigt Text und vorlesbares Label', async (status, label) => {
    await renderWithProviders(<StatusBadge status={status} />).result;
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByLabelText(`Verfügbarkeit: ${label}`)).toBeTruthy();
  });
});

describe('Button-Zustände', () => {
  it('Default: drückbar, Rolle button', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Buchen" onPress={onPress} />).result;
    await fireEvent.press(screen.getByRole('button', { name: 'Buchen' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Deaktiviert: kein onPress, Zustand wird angesagt', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Buchen" onPress={onPress} disabled />).result;
    const button = screen.getByRole('button', { name: 'Buchen' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('Laden: busy statt Spinner', async () => {
    await renderWithProviders(<Button label="Buchen" loading />).result;
    expect(screen.getByRole('button', { name: 'Buchen' })).toBeBusy();
  });
});

describe('Chip', () => {
  it('meldet Auswahl als checked', async () => {
    await renderWithProviders(<Chip label="HNO" selected />).result;
    expect(screen.getByRole('checkbox', { name: 'HNO' })).toBeChecked();
  });
});

describe('TextField', () => {
  it('Fehler werden als Alert vorgelesen', async () => {
    await renderWithProviders(
      <TextField label="Postleitzahl" error="Bitte gib eine fünfstellige Postleitzahl ein." />,
    ).result;
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Bitte gib eine fünfstellige Postleitzahl ein.')).toBeTruthy();
  });
});

describe('Dynamic Type', () => {
  it('Text skaliert bis 200 % (maxFontSizeMultiplier = 2)', async () => {
    await renderWithProviders(<Text>Heute frei</Text>).result;
    expect(screen.getByText('Heute frei').props.maxFontSizeMultiplier).toBe(2);
  });
});

describe('FreshnessLabel: jede Verfügbarkeitsanzeige zeigt ihr Alter', () => {
  it('Minuten', async () => {
    await renderWithProviders(
      <FreshnessLabel lastSyncedAt={new Date(NOW.getTime() - 7 * 60000).toISOString()} />,
    ).result;
    expect(screen.getByText('Aktualisiert vor 7 Min.')).toBeTruthy();
  });
  it('keine Daten', async () => {
    await renderWithProviders(<FreshnessLabel lastSyncedAt={null} />).result;
    expect(screen.getByText('Keine aktuellen Daten')).toBeTruthy();
  });
});

describe('PracticeCard', () => {
  const practice = generateDirectory(cities.fulda).practices[0]!;
  const item: PracticeAvailability = {
    practice,
    status: 'free',
    openCount: 4,
    nextSlot: {
      id: 's1',
      doctorId: 'd',
      practiceId: practice.id,
      startsAt: '2026-10-06T12:30:00Z', // 14:30 Berlin
      endsAt: '2026-10-06T12:45:00Z',
      status: 'open',
      heldUntil: null,
      holdReason: null,
      visitType: 'in_person',
      updatedAt: NOW.toISOString(),
    },
    distanceM: 2300,
    lastSyncedAt: new Date(NOW.getTime() - 5 * 60000).toISOString(),
  };

  it('zeigt „Heute 14:30 · 2,3 km“, Status, Alter und Demo-Kennzeichnung', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<PracticeCard item={item} onPress={onPress} />).result;
    expect(screen.getByText('Heute 14:30 · 2,3 km')).toBeTruthy();
    expect(screen.getByText('4 freie Termine')).toBeTruthy();
    expect(screen.getByText('Aktualisiert vor 5 Min.')).toBeTruthy();
    expect(screen.getByText('Demo')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledWith(practice.id);
  });
});

describe('Avatar-Initialen', () => {
  it('ignorieren Titel und Füllwörter', () => {
    expect(initialsOf('Dr. med. Lea Brandt')).toBe('LB');
    expect(initialsOf('Hausarztpraxis am Lindenhof')).toBe('HL');
  });
});

describe('ConfirmDialog', () => {
  it('Web: eigener Dialog statt wirkungslosem Alert, Ergebnis als Promise', async () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'web');
    const results: boolean[] = [];
    function Trigger() {
      const confirm = useConfirm();
      return (
        <Button
          label="Stornieren"
          onPress={() =>
            void confirm({
              title: 'Termin stornieren?',
              confirmLabel: 'Ja',
              destructive: true,
            }).then((ok) => results.push(ok))
          }
        />
      );
    }
    await renderWithProviders(<Trigger />).result;
    await fireEvent.press(screen.getByText('Stornieren'));
    expect(await screen.findByText('Termin stornieren?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-accept'));
    await waitFor(() => expect(results).toEqual([true]));
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();

    await fireEvent.press(screen.getByText('Stornieren'));
    await fireEvent.press(await screen.findByTestId('confirm-cancel'));
    await waitFor(() => expect(results).toEqual([true, false]));
    platform.restore();
  });
});
