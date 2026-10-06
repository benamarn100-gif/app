import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestRepository } from '../test/render';
import { DashboardError } from '../data/types';

const NOW = new Date('2026-10-06T08:00:00Z'); // Dienstag, 10:00 Berlin

async function setup() {
  const repo = createTestRepository({ now: () => NOW });
  const [membership] = await repo.myPractices();
  if (!membership) throw new Error('keine Demo-Praxis');
  const week = await repo.week(
    membership.practice.id,
    NOW,
    new Date(NOW.getTime() + 14 * 86_400_000),
  );
  return { repo, practiceId: membership.practice.id, week };
}

async function code(promise: Promise<unknown>) {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return error instanceof DashboardError ? error.code : String(error);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Demo-Praxis', () => {
  it('ist eine erkennbare Demo-Praxis mit Ärztinnen/Ärzten und Slots', async () => {
    const { repo, week } = await setup();
    const [membership] = await repo.myPractices();
    expect(membership?.role).toBe('owner');
    expect(week.practice.isDemo).toBe(true);
    expect(week.doctors.length).toBeGreaterThan(0);
    expect(week.slots.length).toBeGreaterThan(20);
    expect(week.slots.every((s) => s.status !== 'cancelled')).toBe(true);
  });

  it('Buchungen tragen nur fiktive Namen und Telefonnummern aus dem Film-/TV-Bereich', async () => {
    const { repo, practiceId } = await setup();
    const bookings = await repo.bookings(
      practiceId,
      new Date(NOW.getTime() - 86_400_000),
      new Date(NOW.getTime() + 14 * 86_400_000),
    );
    expect(bookings.length).toBeGreaterThan(0);
    for (const booking of bookings) {
      expect(booking.contact?.fullName).toMatch(/Mustermann|Beispiel|Muster|Exempel/);
      expect(booking.contact?.phone.startsWith('+49 69 90009 9')).toBe(true);
    }
  });

  it('legt Slots an und prüft Regeln wie die Datenbank', async () => {
    const { repo, practiceId, week } = await setup();
    const doctorId = week.doctors[0]!.id;
    const tomorrow6 = new Date('2026-10-07T04:00:00Z'); // 06:00 Berlin, vor Sprechstundenbeginn
    expect(
      await code(
        repo.createSlot(practiceId, {
          doctorId,
          startsAt: new Date('2026-10-05T08:00:00Z'),
          minutes: 15,
          visitType: 'in_person',
        }),
      ),
    ).toBe('invalid_input');
    const slot = await repo.createSlot(practiceId, {
      doctorId,
      startsAt: tomorrow6,
      minutes: 20,
      visitType: 'in_person',
    });
    expect(slot.status).toBe('open');
    expect(slot.source).toBe('practice_dashboard');
    expect(
      await code(
        repo.createSlot(practiceId, {
          doctorId,
          startsAt: new Date('2026-10-07T04:10:00Z'),
          minutes: 15,
          visitType: 'in_person',
        }),
      ),
    ).toBe('slot_overlap');
    expect(
      await code(
        repo.createSlot('fremde-praxis', {
          doctorId,
          startsAt: tomorrow6,
          minutes: 15,
          visitType: 'in_person',
        }),
      ),
    ).toBe('forbidden');
    const after = await repo.week(practiceId, NOW, new Date(NOW.getTime() + 7 * 86_400_000));
    expect(after.lastSyncedAt).toBe(NOW.toISOString());
  });

  it('entfernt nur freie Slots; gebuchte werden über die Buchung abgesagt', async () => {
    const { repo, practiceId, week } = await setup();
    const open = week.slots.find((s) => s.status === 'open')!;
    const booked = week.slots.find((s) => s.appointmentId && new Date(s.startsAt) > NOW)!;
    expect(await code(repo.cancelSlot(practiceId, booked.id))).toBe('slot_booked');
    await repo.cancelSlot(practiceId, open.id);
    const after = await repo.week(practiceId, NOW, new Date(NOW.getTime() + 14 * 86_400_000));
    expect(after.slots.some((s) => s.id === open.id)).toBe(false);

    await repo.cancelAppointment(practiceId, booked.appointmentId!);
    const bookings = await repo.bookings(
      practiceId,
      NOW,
      new Date(NOW.getTime() + 14 * 86_400_000),
    );
    const cancelled = bookings.find((b) => b.id === booked.appointmentId);
    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.contact).toBeNull();
    expect(await code(repo.cancelAppointment(practiceId, booked.appointmentId!))).toBe('not_found');
  });

  it('Vorlagen: Überschneidung verhindert, Anwenden ist idempotent', async () => {
    const { repo, practiceId, week } = await setup();
    const doctorId = week.doctors[0]!.id;
    await repo.addTemplate(practiceId, {
      doctorId,
      weekday: 6,
      startTime: '06:00',
      endTime: '07:00',
      slotMinutes: 20,
      visitType: 'in_person',
    });
    expect(
      await code(
        repo.addTemplate(practiceId, {
          doctorId,
          weekday: 6,
          startTime: '06:40',
          endTime: '08:00',
          slotMinutes: 20,
          visitType: 'in_person',
        }),
      ),
    ).toBe('template_overlap');
    const created = await repo.applyTemplates(practiceId, '2026-10-05', 2);
    expect(created).toBe(6);
    expect(await repo.applyTemplates(practiceId, '2026-10-05', 2)).toBe(0);
    expect(await code(repo.applyTemplates(practiceId, '2026-10-05', 9))).toBe('invalid_input');
  });

  it('simuliert eine neue Buchung über die App (Live-Vorführung)', async () => {
    vi.useFakeTimers();
    const repo = createTestRepository({ now: () => NOW, simulateLive: true, liveDelayMs: 1000 });
    const [membership] = await repo.myPractices();
    const listener = vi.fn();
    const unsubscribe = repo.subscribe(membership!.practice, listener);
    vi.advanceTimersByTime(1000);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: 'booked' }));
    const slotId = listener.mock.calls[0]![0].slotId as string;
    const bookings = await repo.bookings(
      membership!.practice.id,
      NOW,
      new Date(NOW.getTime() + 3 * 86_400_000),
    );
    expect(bookings.some((b) => b.slotId === slotId && b.status === 'confirmed')).toBe(true);
    unsubscribe();
  });
});
