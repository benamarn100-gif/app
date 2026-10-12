import { Linking } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import type { Practice } from '@/domain/types';
import { PracticeCard } from '@/components';
import { AcuteScreen } from '@/features/acute/AcuteScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { WaitlistScreen } from '@/features/waitlist/WaitlistScreen';
import {
  AccessibilityInfo,
  LanguagesAndInsurance,
  OpeningHours,
  SourceInfo,
} from '@/features/practice/PracticeDetails';
import { createTestRepository, renderWithProviders } from '@/test/render';

import { mockParams } from '../../../jest.setup';

/** Praxis aus dem OpenStreetMap-Verzeichnis: echte Adresse, keine Termine, vieles unbekannt. */
const directoryPractice: Practice = {
  id: 'p-osm',
  name: 'Hausarztpraxis Beispiel',
  address: { street: 'Bahnhofstraße 5', postalCode: '36037', city: 'Fulda' },
  location: { lat: 50.554, lng: 9.681 },
  phone: '+49 661 1234',
  website: null,
  languages: ['de'],
  accessibility: {},
  acceptsPublic: true,
  acceptsPrivate: true,
  offersVideo: false,
  openingHours: {},
  services: [],
  photoUrl: null,
  photoBlurhash: null,
  rating: null,
  specialtyIds: [1],
  isDemo: false,
  source: 'osm',
  sourceLicense: '© OpenStreetMap-Mitwirkende, ODbL 1.0',
  sourceUrl: 'https://www.openstreetmap.org/node/1001',
  verifiedAt: null,
};

describe('Verzeichnis-Praxen (OpenStreetMap)', () => {
  it('zeigt „keine Angaben“ statt erfundener Werte', async () => {
    await renderWithProviders(
      <>
        <OpeningHours practice={directoryPractice} />
        <AccessibilityInfo practice={directoryPractice} />
        <LanguagesAndInsurance practice={directoryPractice} />
      </>,
    ).result;
    expect(screen.getByText(/Keine Angaben zu den Sprechzeiten/)).toBeTruthy();
    expect(screen.queryByText('geschlossen')).toBeNull();
    expect(screen.getByText(/Keine Angaben zur Barrierefreiheit/)).toBeTruthy();
    expect(screen.getByText(/Keine geprüfte Angabe zur Versicherung/)).toBeTruthy();
    expect(screen.queryByText(/Gesetzlich versichert/)).toBeNull();
  });

  it('zeigt vorhandene Sprechzeiten mit Hinweis auf die Quelle', async () => {
    await renderWithProviders(
      <OpeningHours
        practice={{
          ...directoryPractice,
          openingHours: { mon: [{ open: '08:00', close: '12:00' }] },
        }}
      />,
    ).result;
    expect(screen.getByText('08:00–12:00')).toBeTruthy();
    expect(screen.getByText(/Laut OpenStreetMap, ohne Gewähr/)).toBeTruthy();
  });

  it('nennt die Quelle und verlinkt zum Korrigieren', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderWithProviders(<SourceInfo practice={directoryPractice} lastSyncedAt={null} />)
      .result;
    expect(screen.getByText('OpenStreetMap (ODbL)')).toBeTruthy();
    expect(screen.getByText(/bietet ihre Termine \(noch\) nicht über Terminlücke an/)).toBeTruthy();
    fireEvent.press(screen.getByText(/In OpenStreetMap korrigieren/));
    expect(open).toHaveBeenCalledWith('https://www.openstreetmap.org/node/1001');
    open.mockRestore();
  });

  it('Demo- und Praxisdaten bleiben wie bisher', async () => {
    await renderWithProviders(
      <LanguagesAndInsurance practice={{ ...directoryPractice, source: 'practice_dashboard' }} />,
    ).result;
    expect(screen.getByText('Gesetzlich versichert · Privat versichert')).toBeTruthy();
  });

  it('Trefferliste: „Keine Online-Termine“ mit Entfernung, ohne Datenalter', async () => {
    await renderWithProviders(
      <PracticeCard
        item={{
          practice: directoryPractice,
          status: 'unknown',
          openCount: 0,
          nextSlot: null,
          distanceM: 1200,
          lastSyncedAt: null,
        }}
        testID="card"
      />,
    ).result;
    expect(screen.getByText('Keine Online-Termine')).toBeTruthy();
    expect(screen.getByText('Für Termine bitte anrufen · 1,2 km')).toBeTruthy();
    expect(screen.queryByText('Keine aktuellen Daten')).toBeNull();
  });

  describe('Nur Verzeichnis-Praxen in der Nähe (noch keine Pilotpraxis)', () => {
    const onlyDirectory = () => {
      const repository = createTestRepository();
      jest.spyOn(repository, 'search').mockResolvedValue(
        [0, 1, 2].map((i) => ({
          practice: { ...directoryPractice, id: `p-osm-${i}`, name: `Praxis ${i}` },
          status: 'unknown' as const,
          openCount: 0,
          nextSlot: null,
          distanceM: 500 + i * 300,
          lastSyncedAt: null,
        })),
      );
      return repository;
    };

    it('Startseite behauptet nicht „alles vergeben“', async () => {
      await renderWithProviders(<HomeScreen />, { repository: onlyDirectory() }).result;
      expect(await screen.findByTestId('nearby-no-online')).toBeTruthy();
      expect(screen.getByText(/Hier bietet noch keine Praxis Online-Termine an/)).toBeTruthy();
      expect(screen.queryByText(/alles vergeben/)).toBeNull();
      expect(screen.queryByText(/ist gerade nichts frei/)).toBeNull();
    });

    it('Termin-Alarm sagt vorher, dass er erst greift, wenn eine Praxis mitmacht', async () => {
      mockParams.current = { practiceId: 'any' };
      await renderWithProviders(<WaitlistScreen />, { repository: onlyDirectory() }).result;
      expect(await screen.findByTestId('alarm-no-online')).toBeTruthy();
      expect(screen.getByText(/sobald eine Praxis hier mitmacht/)).toBeTruthy();
    });

    it('„Heute“ sagt es offen und zeigt die Praxen zum Anrufen', async () => {
      await renderWithProviders(<AcuteScreen />, { repository: onlyDirectory() }).result;
      expect(await screen.findByTestId('acute-no-online')).toBeTruthy();
      expect(screen.getByText('Ohne Online-Termine')).toBeTruthy();
      expect(screen.getAllByText('Anrufen').length).toBeGreaterThan(0);
    });
  });
});
