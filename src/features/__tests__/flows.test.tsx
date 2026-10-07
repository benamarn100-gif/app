import { Alert } from 'react-native';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { queryKeys } from '@/data/queryKeys';
import { HEALTH_CONSENT_VERSION } from '@/data/repository';
import { summarizeSlots } from '@/domain/availability/status';
import { AcuteScreen } from '@/features/acute/AcuteScreen';
import { AppointmentsScreen } from '@/features/appointments/AppointmentsScreen';
import { BookingScreen } from '@/features/booking/BookingScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { PracticeScreen } from '@/features/practice/PracticeScreen';
import { setNowOverride } from '@/lib/useNow';
import { createTestRepository, renderWithProviders } from '@/test/render';

import { mockFocus, mockParams, mockRouter } from '../../../jest.setup';

const NOW = new Date('2026-10-06T07:30:00Z'); // Dienstag, 09:30 Berlin

beforeAll(() => setNowOverride(NOW));
afterAll(() => setNowOverride(null));
jest.setTimeout(30_000);

describe('Phase 2 – Entdecken (DoD: ≤ 3 Taps bis zu Praxen mit korrektem Status)', () => {
  it('Tap 1: Hero „Ich brauche schnell einen Termin“ öffnet den Akut-Modus', async () => {
    await renderWithProviders(<HomeScreen />, { repository: createTestRepository(NOW) }).result;
    const hero = await screen.findByTestId('hero-acute');
    await fireEvent.press(hero);
    expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)/today');
  });

  it('Akut-Modus zeigt Praxen mit Status, frühester Termin zuerst', async () => {
    const repository = createTestRepository(NOW);
    await renderWithProviders(<AcuteScreen />, { repository }).result;
    await screen.findByTestId('acute-result-0');

    // Erwartung unabhängig berechnen: dieselben Slots, Statusregel aus der Domain
    const expected = (
      await repository.search(
        {
          center: { lat: 50.5558, lng: 9.6808 },
          radiusKm: 10,
          window: 'today',
          specialtyIds: [],
          languages: [],
          accessibility: [],
          insurance: 'any',
          videoOnly: false,
          text: '',
        },
        NOW,
      )
    )
      .filter((r) => r.nextSlot)
      .sort(
        (a, b) =>
          Date.parse(a.nextSlot!.startsAt) - Date.parse(b.nextSlot!.startsAt) ||
          (a.distanceM ?? 0) - (b.distanceM ?? 0),
      );

    const first = within(screen.getByTestId('acute-result-0'));
    expect(first.getByText(expected[0]!.practice.name)).toBeTruthy();
    // Status steht als Text + Icon in der Karte (nie nur Farbe)
    const status = expected[0]!.status;
    expect(first.getByTestId(`status-${status}`)).toBeTruthy();
    // Statusregel konsistent mit Domain
    const slots = await repository.getSlots(
      expected[0]!.practice.id,
      new Date(NOW.getTime() - 864e5),
      new Date(NOW.getTime() + 864e5),
    );
    expect(summarizeSlots(slots, 'today', expected[0]!.lastSyncedAt, NOW).status).toBe(status);
  });
});

describe('Phase 3 – Buchen (DoD: buchbar und stornierbar)', () => {
  it('bucht in 4 Schritten mit Einwilligung und führt zum Erfolg; Storno gibt den Slot frei', async () => {
    const repository = createTestRepository(NOW);
    const results = await repository.search(
      {
        center: { lat: 50.5558, lng: 9.6808 },
        radiusKm: 10,
        window: 'week',
        specialtyIds: [],
        languages: [],
        accessibility: [],
        insurance: 'any',
        videoOnly: false,
        text: '',
      },
      NOW,
    );
    const target = results.find((r) => r.nextSlot)!;
    mockParams.current = { slotId: target.nextSlot!.id, practiceId: target.practice.id };

    await renderWithProviders(<BookingScreen />, { repository }).result;
    // Schritt 1: Slot ist 5 Minuten reserviert
    await screen.findByTestId('hold-countdown');
    expect(repository.peekSlot(target.nextSlot!.id)?.status).toBe('held');
    await fireEvent.press(screen.getByTestId('booking-next'));
    // Schritt 2 + 3
    await fireEvent.press(await screen.findByTestId('booking-next'));
    await fireEvent.press(await screen.findByTestId('booking-next'));
    // Schritt 4: Kontakt + ausdrückliche Einwilligung (nicht vorangekreuzt)
    const consent = await screen.findByTestId('consent-checkbox');
    expect(consent).not.toBeChecked();
    await fireEvent.changeText(screen.getByLabelText('Vor- und Nachname'), 'Alex Beispiel');
    await fireEvent.changeText(screen.getByLabelText('Telefonnummer'), '0661 123456');
    // Ohne Einwilligung wird nicht gebucht
    await fireEvent.press(screen.getByTestId('booking-submit'));
    expect(
      await screen.findByText('Ohne diese Einwilligung können wir den Termin nicht buchen.'),
    ).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await fireEvent.press(consent);
    await fireEvent.press(screen.getByTestId('booking-submit'));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    const call = mockRouter.replace.mock.calls[0]![0] as {
      pathname: string;
      params: { appointmentId: string };
    };
    expect(call.pathname).toBe('/booking/success');
    expect(repository.peekSlot(target.nextSlot!.id)?.status).toBe('booked');
    const consents = await repository.listConsents();
    expect(consents).toEqual([
      expect.objectContaining({
        type: 'health_data',
        version: HEALTH_CONSENT_VERSION,
        revokedAt: null,
      }),
    ]);

    // Storno über „Meine Termine“
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const destructive = buttons?.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });
    await screen.unmount?.();
    await renderWithProviders(<AppointmentsScreen />, { repository }).result;
    await fireEvent.press(await screen.findByTestId('cancel-appointment'));
    await waitFor(() => expect(repository.peekSlot(target.nextSlot!.id)?.status).toBe('open'));
    expect(
      await screen.findByText('Termin storniert. Der Platz ist jetzt für andere frei.'),
    ).toBeTruthy();
  });
});

describe('Praxisprofil – Hinweis „gerade vergeben“', () => {
  const TAKEN =
    'Dieser Termin wurde gerade vergeben. Wähle einfach eine andere Zeit – die nächsten freien stehen direkt darunter.';

  async function openPracticeWithSlot() {
    const repository = createTestRepository(NOW);
    const results = await repository.search(
      {
        center: { lat: 50.5558, lng: 9.6808 },
        radiusKm: 10,
        window: 'week',
        specialtyIds: [],
        languages: [],
        accessibility: [],
        insurance: 'any',
        videoOnly: false,
        text: '',
      },
      NOW,
    );
    const target = results.find((r) => r.nextSlot)!;
    mockParams.current = { id: target.practice.id, slot: target.nextSlot!.id };
    const view = renderWithProviders(<PracticeScreen />, { repository });
    await view.result;
    await screen.findByTestId('practice-screen');
    return { repository, slotId: target.nextSlot!.id, client: view.client };
  }

  it('erscheint, wenn jemand anderes den gewählten Termin bucht', async () => {
    const { repository, slotId } = await openPracticeWithSlot();
    repository.bookSlotAsOtherUser(slotId);
    expect(await screen.findByText(TAKEN)).toBeTruthy();
  });

  it('erscheint nicht für die eigene Buchung (Buchungs-Sheet liegt über der Praxis)', async () => {
    const { repository, slotId, client } = await openPracticeWithSlot();
    mockFocus.current = false; // Buchungs-Sheet ist geöffnet
    await repository.grantConsent('health_data', HEALTH_CONSENT_VERSION);
    await repository.bookSlot({
      slotId,
      idempotencyKey: 'eigene-buchung-1',
      dependentId: null,
      reasonCategory: null,
      contact: { fullName: 'Alex Beispiel', phone: '0661 123456', insurance: 'public' },
      consentVersion: HEALTH_CONSENT_VERSION,
    });
    await client.invalidateQueries({ queryKey: queryKeys.appointments });
    await waitFor(() => expect(repository.peekSlot(slotId)?.status).toBe('booked'));
    mockFocus.current = true; // zurück auf der Praxisseite
    screen.rerender(<PracticeScreen />);
    await waitFor(() => expect(screen.getByTestId('practice-screen')).toBeTruthy());
    expect(screen.queryByText(TAKEN)).toBeNull();
  });
});

describe('Startseite – nächster Termin und freie Ärzte auf einen Blick', () => {
  async function bookFirstFreeSlot(repository: ReturnType<typeof createTestRepository>) {
    const results = await repository.search(
      {
        center: { lat: 50.5558, lng: 9.6808 },
        radiusKm: 10,
        window: 'week',
        specialtyIds: [],
        languages: [],
        accessibility: [],
        insurance: 'any',
        videoOnly: false,
        text: '',
      },
      NOW,
    );
    const target = results.find((r) => r.nextSlot && r.nextSlot.visitType !== 'video')!;
    await repository.grantConsent('health_data', HEALTH_CONSENT_VERSION);
    await repository.bookSlot({
      slotId: target.nextSlot!.id,
      idempotencyKey: 'startseite-1',
      dependentId: null,
      reasonCategory: null,
      contact: { fullName: 'Alex Beispiel', phone: '0661 123456', insurance: 'public' },
      consentVersion: HEALTH_CONSENT_VERSION,
    });
    return target;
  }

  it('ohne Termin: Hero führt in den Akut-Modus, darunter Suche und freie Praxen', async () => {
    await renderWithProviders(<HomeScreen />, { repository: createTestRepository(NOW) }).result;
    expect(await screen.findByTestId('hero-acute')).toBeTruthy();
    expect(screen.getByTestId('home-search')).toBeTruthy();
    expect(await screen.findByTestId('nearby-card-0')).toBeTruthy();
    expect(screen.queryByTestId('hero-appointment')).toBeNull();
  });

  it('mit Termin: Hero zeigt Arzt, Zeitpunkt und Route', async () => {
    const repository = createTestRepository(NOW);
    const target = await bookFirstFreeSlot(repository);
    await renderWithProviders(<HomeScreen />, { repository }).result;
    const hero = await screen.findByTestId('hero-appointment');
    expect(within(hero).getByText(new RegExp(target.practice.name))).toBeTruthy();
    expect(screen.getByTestId('hero-route')).toBeTruthy();
    expect(screen.queryByTestId('hero-acute')).toBeNull();
  });

  it('kurz vor dem Termin: Hero zeigt „Zeit loszufahren“', async () => {
    const repository = createTestRepository(NOW);
    const target = await bookFirstFreeSlot(repository);
    // 10 Minuten vor Beginn liegt immer nach dem Abfahrtszeitpunkt (mindestens 15 Min. vorher)
    setNowOverride(new Date(Date.parse(target.nextSlot!.startsAt) - 10 * 60_000));
    try {
      await renderWithProviders(<HomeScreen />, { repository }).result;
      expect(await screen.findByTestId('hero-leave-now')).toBeTruthy();
      expect(screen.getByText('Zeit loszufahren')).toBeTruthy();
    } finally {
      setNowOverride(NOW);
    }
  });

  it('„Deine Praxen“: zuletzt gebuchte Praxis mit direkter Buchung des nächsten Termins', async () => {
    const repository = createTestRepository(NOW);
    const target = await bookFirstFreeSlot(repository);
    await renderWithProviders(<HomeScreen />, { repository }).result;
    const card = await screen.findByTestId('my-practice-0');
    expect(within(card).getByText(target.practice.name)).toBeTruthy();
    await fireEvent.press(await screen.findByTestId('my-practice-book-0'));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/booking/[slotId]',
        params: expect.objectContaining({ practiceId: target.practice.id }),
      }),
    );
  });

  it('Schnellfilter setzt das Zeitfenster und öffnet die Suche', async () => {
    await renderWithProviders(<HomeScreen />, { repository: createTestRepository(NOW) }).result;
    await fireEvent.press(await screen.findByTestId('quick-week'));
    expect(mockRouter.navigate).toHaveBeenCalledWith({
      pathname: '/(tabs)/search',
      params: { view: 'list' },
    });
  });
});
