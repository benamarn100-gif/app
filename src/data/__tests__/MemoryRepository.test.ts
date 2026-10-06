import { cities } from '@/config/city';
import { rankAcute } from '@/domain/ranking/acute';

import { MemoryRepository } from '../memory/MemoryRepository';
import { AppError, HEALTH_CONSENT_VERSION, type SearchParams } from '../repository';

const NOW = new Date('2026-10-06T06:30:00Z'); // Di 08:30 Berlin

const baseParams: SearchParams = {
  center: cities.fulda.center,
  radiusKm: 10,
  window: 'week',
  specialtyIds: [],
  languages: [],
  accessibility: [],
  insurance: 'any',
  videoOnly: false,
  text: '',
};

const contact = { fullName: 'Alex Beispiel', phone: '0661 123456', insurance: 'public' as const };

function createRepo(now = NOW) {
  let current = now;
  const repo = new MemoryRepository({ city: cities.fulda, now: () => current, latencyMs: 0 });
  return { repo, advance: (ms: number) => (current = new Date(current.getTime() + ms)) };
}

async function firstOpenSlot(repo: MemoryRepository) {
  const results = rankAcute(await repo.search({ ...baseParams, window: 'week' }, NOW));
  const withSlot = results.find((r) => r.nextSlot);
  if (!withSlot?.nextSlot) throw new Error('kein offener Slot im Seed');
  return withSlot.nextSlot;
}

describe('MemoryRepository', () => {
  it('findet Praxen im Umkreis mit Status und Alter der Daten', async () => {
    const { repo } = createRepo();
    const results = await repo.search(baseParams, NOW);
    expect(results.length).toBeGreaterThan(30);
    expect(results.every((r) => r.distanceM !== null && r.distanceM <= 10_000)).toBe(true);
    expect(new Set(results.map((r) => r.status)).size).toBeGreaterThanOrEqual(3);
    expect(results.some((r) => r.status === 'unknown' && r.nextSlot === null)).toBe(true);
  });

  it('filtert nach Fachrichtung, Sprache und Video', async () => {
    const { repo } = createRepo();
    const kids = await repo.search({ ...baseParams, specialtyIds: [3] }, NOW);
    expect(kids.length).toBeGreaterThan(0);
    expect(kids.every((r) => r.practice.specialtyIds.includes(3))).toBe(true);
    const video = await repo.search({ ...baseParams, videoOnly: true }, NOW);
    expect(video.every((r) => r.practice.offersVideo)).toBe(true);
    const english = await repo.search({ ...baseParams, languages: ['en'] }, NOW);
    expect(english.every((r) => r.practice.languages.includes('en'))).toBe(true);
  });

  it('Textsuche findet Fachrichtungen', async () => {
    const { repo } = createRepo();
    const results = await repo.search({ ...baseParams, text: 'zahn' }, NOW);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.practice.specialtyIds.includes(9))).toBe(true);
  });

  it('bucht atomar: zweiter Versuch auf denselben Slot schlägt fehl, Idempotenz liefert dasselbe Ergebnis', async () => {
    const { repo } = createRepo();
    await repo.grantConsent('health_data', HEALTH_CONSENT_VERSION);
    const slot = await firstOpenSlot(repo);
    const input = {
      slotId: slot.id,
      idempotencyKey: 'k1',
      dependentId: null,
      reasonCategory: null,
      contact,
      consentVersion: HEALTH_CONSENT_VERSION,
    };
    const a = await repo.bookSlot(input);
    const again = await repo.bookSlot(input);
    expect(again.id).toBe(a.id);
    await expect(repo.bookSlot({ ...input, idempotencyKey: 'k2' })).rejects.toMatchObject({
      code: 'slot_taken',
    });
    expect(repo.peekSlot(slot.id)?.status).toBe('booked');
  });

  it('ohne Einwilligung keine Buchung', async () => {
    const { repo } = createRepo();
    const slot = await firstOpenSlot(repo);
    await expect(
      repo.bookSlot({
        slotId: slot.id,
        idempotencyKey: 'x',
        dependentId: null,
        reasonCategory: null,
        contact,
        consentVersion: HEALTH_CONSENT_VERSION,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('hält einen Slot 5 Minuten; nach Ablauf ist er wieder frei', async () => {
    const { repo, advance } = createRepo();
    const slot = await firstOpenSlot(repo);
    const hold = await repo.holdSlot(slot.id);
    expect(Date.parse(hold.heldUntil) - NOW.getTime()).toBe(5 * 60_000);
    expect(repo.peekSlot(slot.id)?.status).toBe('held');
    advance(5 * 60_000 + 1000);
    const results = await repo.search(baseParams, new Date(NOW.getTime() + 5 * 60_000 + 1000));
    const practice = results.find((r) => r.practice.id === slot.practiceId);
    expect(practice?.openCount).toBeGreaterThan(0);
  });

  it('Storno gibt den Slot frei', async () => {
    const { repo } = createRepo();
    await repo.grantConsent('health_data', HEALTH_CONSENT_VERSION);
    const slot = await firstOpenSlot(repo);
    const appt = await repo.bookSlot({
      slotId: slot.id,
      idempotencyKey: 'c1',
      dependentId: null,
      reasonCategory: 'checkup',
      contact,
      consentVersion: HEALTH_CONSENT_VERSION,
    });
    await repo.cancelAppointment(appt.id);
    expect(repo.peekSlot(slot.id)?.status).toBe('open');
    const list = await repo.listAppointments();
    expect(list.find((a) => a.id === appt.id)?.status).toBe('cancelled');
  });

  it('Warteliste: freiwerdender Slot → Angebot mit 10 Minuten; Ablauf gibt Slot wieder frei', async () => {
    const { repo, advance } = createRepo();
    await repo.grantConsent('health_data', HEALTH_CONSENT_VERSION);
    const results = await repo.search(baseParams, NOW);
    jest.useFakeTimers();
    const bookedPractice = results.find((r) => r.status === 'booked' || r.status === 'few');
    expect(bookedPractice).toBeDefined();
    const offers: string[] = [];
    repo.subscribeToOffers((o) => offers.push(o.id));
    await repo.joinWaitlist(
      {
        target: { kind: 'practice', practiceId: bookedPractice!.practice.id },
        days: 14,
        maxDistanceKm: 25,
      },
      cities.fulda.center,
    );
    const slots = await repo.getSlots(
      bookedPractice!.practice.id,
      NOW,
      new Date(NOW.getTime() + 13 * 864e5),
    );
    const booked = slots.find((s) => s.status === 'booked');
    expect(booked).toBeDefined();
    repo.releaseSlotAsOtherUser(booked!.id);
    expect(offers).toHaveLength(1);
    expect(repo.peekSlot(booked!.id)).toMatchObject({
      status: 'held',
      holdReason: 'waitlist_offer',
    });
    advance(10 * 60_000 + 1);
    jest.advanceTimersByTime(10 * 60_000 + 1);
    expect(repo.peekSlot(booked!.id)?.status).toBe('open');
    const all = await repo.listOffers();
    expect(all[0]?.status).toBe('expired');
    repo.dispose();
    jest.useRealTimers();
  });
});
