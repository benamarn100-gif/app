import { isSlotBookable, statusFromCount, summarizeSlots } from '../availability/status';
import { compareRelevance, rankAcute } from '../ranking/acute';
import type { Practice, PracticeAvailability, Slot } from '../types';

const now = new Date('2026-10-06T08:00:00Z'); // Di 10:00 Berlin
const fresh = new Date(now.getTime() - 10 * 60000).toISOString();

function slot(partial: Partial<Slot> & { startsAt: string }): Slot {
  return {
    id: partial.id ?? partial.startsAt,
    doctorId: 'd1',
    practiceId: 'p1',
    endsAt: new Date(Date.parse(partial.startsAt) + 15 * 60000).toISOString(),
    status: 'open',
    heldUntil: null,
    holdReason: null,
    visitType: 'in_person',
    updatedAt: fresh,
    ...partial,
  };
}

describe('Statusregel', () => {
  it.each([
    [0, 'booked'],
    [1, 'few'],
    [2, 'few'],
    [3, 'free'],
    [12, 'free'],
  ] as const)('%i offene Slots → %s', (count, expected) => {
    expect(statusFromCount(count, fresh, now)).toBe(expected);
  });

  it('keine Daten → unknown', () => {
    expect(statusFromCount(5, null, now)).toBe('unknown');
  });

  it('Daten älter als 24 h → unknown, genau 24 h → noch gültig', () => {
    const exactly24h = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const older = new Date(now.getTime() - 24 * 3600 * 1000 - 1).toISOString();
    expect(statusFromCount(5, exactly24h, now)).toBe('free');
    expect(statusFromCount(5, older, now)).toBe('unknown');
  });

  it('vergangene, gebuchte und aktiv gehaltene Slots zählen nicht; abgelaufene Holds schon', () => {
    expect(isSlotBookable(slot({ startsAt: '2026-10-06T07:00:00Z' }), now)).toBe(false);
    expect(isSlotBookable(slot({ startsAt: '2026-10-06T09:00:00Z', status: 'booked' }), now)).toBe(
      false,
    );
    expect(
      isSlotBookable(
        slot({
          startsAt: '2026-10-06T09:00:00Z',
          status: 'held',
          heldUntil: '2026-10-06T08:03:00Z',
        }),
        now,
      ),
    ).toBe(false);
    expect(
      isSlotBookable(
        slot({
          startsAt: '2026-10-06T09:00:00Z',
          status: 'held',
          heldUntil: '2026-10-06T07:59:00Z',
        }),
        now,
      ),
    ).toBe(true);
  });

  it('summarizeSlots zählt nur das Zeitfenster und findet den nächsten Slot', () => {
    const slots = [
      slot({ id: 'a', startsAt: '2026-10-06T12:00:00Z' }),
      slot({ id: 'b', startsAt: '2026-10-06T09:30:00Z' }),
      slot({ id: 'c', startsAt: '2026-10-07T07:00:00Z' }), // morgen
      slot({ id: 'd', startsAt: '2026-10-06T10:00:00Z', status: 'booked' }),
    ];
    const today = summarizeSlots(slots, 'today', fresh, now);
    expect(today).toMatchObject({ status: 'few', openCount: 2 });
    expect(today.nextSlot?.id).toBe('b');
    expect(summarizeSlots(slots, 'tomorrow', fresh, now)).toMatchObject({
      status: 'few',
      openCount: 1,
    });
    expect(summarizeSlots(slots, 'week', fresh, now)).toMatchObject({
      status: 'free',
      openCount: 3,
    });
  });

  it('veraltete Daten liefern keinen nächsten Slot (keine falsche Zusage)', () => {
    const stale = new Date(now.getTime() - 30 * 3600 * 1000).toISOString();
    const result = summarizeSlots(
      [slot({ startsAt: '2026-10-06T12:00:00Z' })],
      'today',
      stale,
      now,
    );
    expect(result).toEqual({ status: 'unknown', openCount: 0, nextSlot: null });
  });
});

function item(
  name: string,
  opts: {
    next?: string | null;
    distanceM?: number | null;
    rating?: number | null;
    status?: PracticeAvailability['status'];
  },
): PracticeAvailability {
  const practice = {
    id: name,
    name,
    rating: opts.rating == null ? null : { average: opts.rating, count: 10 },
  } as Practice;
  return {
    practice,
    status: opts.status ?? (opts.next ? 'free' : 'booked'),
    openCount: opts.next ? 3 : 0,
    nextSlot: opts.next ? slot({ startsAt: opts.next }) : null,
    distanceM: opts.distanceM ?? null,
    lastSyncedAt: fresh,
  };
}

describe('Akut-Ranking', () => {
  it('sortiert nach frühestem Slot, dann Entfernung, dann Bewertung', () => {
    const ranked = rankAcute([
      item('Später nah', { next: '2026-10-06T13:00:00Z', distanceM: 300, rating: 4.9 }),
      item('Früh weit', { next: '2026-10-06T09:00:00Z', distanceM: 9000, rating: 4.0 }),
      item('Früh nah schlecht', { next: '2026-10-06T09:00:00Z', distanceM: 1200, rating: 3.8 }),
      item('Früh nah gut', { next: '2026-10-06T09:00:00Z', distanceM: 1200, rating: 4.7 }),
      item('Ohne Bewertung', { next: '2026-10-06T09:00:00Z', distanceM: 1200, rating: null }),
    ]);
    expect(ranked.map((r) => r.practice.name)).toEqual([
      'Früh nah gut',
      'Früh nah schlecht',
      'Ohne Bewertung',
      'Früh weit',
      'Später nah',
    ]);
  });

  it('ausgebuchte Praxen nach buchbaren, unbekannte ganz am Ende', () => {
    const ranked = rankAcute([
      item('Unbekannt nah', { status: 'unknown', distanceM: 100 }),
      item('Ausgebucht', { next: null, distanceM: 200 }),
      item('Frei weit', { next: '2026-10-08T09:00:00Z', distanceM: 20000 }),
    ]);
    expect(ranked.map((r) => r.practice.name)).toEqual([
      'Frei weit',
      'Ausgebucht',
      'Unbekannt nah',
    ]);
  });

  it('ist stabil und verändert die Eingabe nicht', () => {
    const input = [
      item('B', { next: '2026-10-06T09:00:00Z' }),
      item('A', { next: '2026-10-06T09:00:00Z' }),
    ];
    const ranked = rankAcute(input);
    expect(ranked.map((r) => r.practice.name)).toEqual(['A', 'B']);
    expect(input.map((r) => r.practice.name)).toEqual(['B', 'A']);
  });

  it('Relevanz-Sortierung: frei vor wenige vor ausgebucht vor unbekannt', () => {
    const list = [
      item('U', { status: 'unknown', distanceM: 1 }),
      item('B', { status: 'booked', distanceM: 1 }),
      item('F2', { status: 'free', next: '2026-10-06T09:00:00Z', distanceM: 500 }),
      item('W', { status: 'few', next: '2026-10-06T09:00:00Z', distanceM: 1 }),
      item('F1', { status: 'free', next: '2026-10-06T09:00:00Z', distanceM: 100 }),
    ].sort(compareRelevance);
    expect(list.map((r) => r.practice.name)).toEqual(['F1', 'F2', 'W', 'B', 'U']);
  });
});
