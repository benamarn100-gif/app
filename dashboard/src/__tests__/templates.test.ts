// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { expandTemplates, isValidRule, ruleTimes, rulesOverlap } from '../lib/templates';
import {
  addBerlinDays,
  berlinIsoDate,
  dateFromIso,
  isoWeekday,
  startOfBerlinWeek,
  weekdayName,
} from '../lib/time';

const monday = {
  doctorId: 'd1',
  weekday: 1,
  startTime: '09:00',
  endTime: '10:00',
  slotMinutes: 20,
  visitType: 'in_person' as const,
};

describe('Wochenvorlagen', () => {
  it('teilt die Sprechzeit in Termine', () => {
    expect(ruleTimes(monday)).toEqual(['09:00', '09:20', '09:40']);
    expect(ruleTimes({ ...monday, endTime: '09:50' })).toEqual(['09:00', '09:20']);
  });

  it('prüft Dauer und Überschneidung', () => {
    expect(isValidRule(monday)).toBe(true);
    expect(isValidRule({ ...monday, endTime: '09:15' })).toBe(false);
    expect(isValidRule({ ...monday, slotMinutes: 3 })).toBe(false);
    expect(rulesOverlap(monday, { ...monday, startTime: '09:30', endTime: '11:00' })).toBe(true);
    expect(rulesOverlap(monday, { ...monday, startTime: '10:00', endTime: '11:00' })).toBe(false);
    expect(rulesOverlap(monday, { ...monday, doctorId: 'd2' })).toBe(false);
    expect(rulesOverlap(monday, { ...monday, weekday: 2 })).toBe(false);
  });

  it('09:00 Berliner Zeit bleibt 09:00 – vor und nach der Zeitumstellung (wie in SQL)', () => {
    const planned = expandTemplates([monday], '2026-10-19', 2, new Date('2026-10-06T10:00:00Z'));
    expect(planned).toHaveLength(6);
    expect(planned[0]?.startsAt.toISOString()).toBe('2026-10-19T07:00:00.000Z');
    expect(planned[3]?.startsAt.toISOString()).toBe('2026-10-26T08:00:00.000Z');
    expect(planned[3]?.endsAt.toISOString()).toBe('2026-10-26T08:20:00.000Z');
  });

  it('lässt vergangene Termine aus', () => {
    const planned = expandTemplates([monday], '2026-10-19', 1, new Date('2026-10-19T07:10:00Z'));
    expect(planned.map((p) => p.startsAt.toISOString())).toEqual([
      '2026-10-19T07:20:00.000Z',
      '2026-10-19T07:40:00.000Z',
    ]);
  });
});

describe('Berliner Kalender', () => {
  it('findet den Montag der Woche über die Zeitumstellung hinweg', () => {
    expect(startOfBerlinWeek(new Date('2026-10-21T12:00:00Z')).toISOString()).toBe(
      '2026-10-18T22:00:00.000Z',
    );
    expect(startOfBerlinWeek(new Date('2026-10-28T12:00:00Z')).toISOString()).toBe(
      '2026-10-25T23:00:00.000Z',
    );
    // Sonntag 23:30 Berlin gehört noch zur alten Woche
    expect(berlinIsoDate(startOfBerlinWeek(new Date('2026-10-25T22:30:00Z')))).toBe('2026-10-19');
  });

  it('zählt Kalendertage, nicht 24-Stunden-Blöcke', () => {
    const start = dateFromIso('2026-10-20');
    expect(addBerlinDays(start, 6).toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect(berlinIsoDate(addBerlinDays(start, 6))).toBe('2026-10-26');
  });

  it('ISO-Wochentage und Namen', () => {
    expect(isoWeekday(new Date('2026-10-25T10:00:00Z'))).toBe(7);
    expect(isoWeekday(new Date('2026-10-26T10:00:00Z'))).toBe(1);
    expect(weekdayName(1, 'de')).toBe('Montag');
    expect(weekdayName(7, 'en')).toBe('Sunday');
  });
});
