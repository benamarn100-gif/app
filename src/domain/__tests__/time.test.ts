import {
  berlinDateTime,
  berlinDayOffset,
  endOfBerlinDay,
  formatBerlinTime,
  minutesSince,
  startOfBerlinDay,
  windowRange,
} from '../time/berlin';

describe('Europe/Berlin-Zeitlogik', () => {
  it('berechnet „heute“ in Berliner Zeit, auch wenn UTC schon den nächsten Tag hat', () => {
    // 23:30 UTC am 14.07. = 01:30 Berlin am 15.07. (Sommerzeit, UTC+2)
    const now = new Date('2026-07-14T23:30:00Z');
    expect(startOfBerlinDay(now).toISOString()).toBe('2026-07-14T22:00:00.000Z');
    expect(endOfBerlinDay(now).toISOString()).toBe('2026-07-15T21:59:59.999Z');
  });

  it('Winterzeit: Tagesgrenze liegt bei 23:00 UTC', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    expect(startOfBerlinDay(now).toISOString()).toBe('2026-01-09T23:00:00.000Z');
  });

  describe('Sommerzeit-Umstellungen 2026', () => {
    it('29.03.2026 (Vorstellen): Tag hat 23 Stunden', () => {
      const day = new Date('2026-03-29T10:00:00Z');
      const start = startOfBerlinDay(day);
      const end = endOfBerlinDay(day);
      expect(start.toISOString()).toBe('2026-03-28T23:00:00.000Z');
      expect(end.toISOString()).toBe('2026-03-29T21:59:59.999Z');
      expect((end.getTime() + 1 - start.getTime()) / 3_600_000).toBe(23);
    });

    it('25.10.2026 (Zurückstellen): Tag hat 25 Stunden', () => {
      const day = new Date('2026-10-25T10:00:00Z');
      const start = startOfBerlinDay(day);
      const end = endOfBerlinDay(day);
      expect(start.toISOString()).toBe('2026-10-24T22:00:00.000Z');
      expect((end.getTime() + 1 - start.getTime()) / 3_600_000).toBe(25);
    });

    it('Uhrzeit 08:00 Berlin wird vor und nach der Umstellung korrekt in UTC abgebildet', () => {
      expect(berlinDateTime(new Date('2026-03-28T12:00:00Z'), '08:00').toISOString()).toBe(
        '2026-03-28T07:00:00.000Z',
      );
      expect(berlinDateTime(new Date('2026-03-30T12:00:00Z'), '08:00').toISOString()).toBe(
        '2026-03-30T06:00:00.000Z',
      );
      expect(berlinDateTime(new Date('2026-10-26T12:00:00Z'), '08:00').toISOString()).toBe(
        '2026-10-26T07:00:00.000Z',
      );
    });

    it('formatiert UTC-Zeitpunkte als Berliner Uhrzeit', () => {
      expect(formatBerlinTime('2026-10-24T12:30:00Z', 'de-DE')).toBe('14:30');
      expect(formatBerlinTime('2026-10-26T12:30:00Z', 'de-DE')).toBe('13:30');
    });
  });

  it('windowRange: today/tomorrow/week', () => {
    const now = new Date('2026-10-06T08:00:00Z'); // 10:00 Berlin
    expect(windowRange('today', now)).toEqual({
      from: now,
      to: new Date('2026-10-06T21:59:59.999Z'),
    });
    expect(windowRange('tomorrow', now)).toEqual({
      from: new Date('2026-10-06T22:00:00.000Z'),
      to: new Date('2026-10-07T21:59:59.999Z'),
    });
    // „Diese Woche“ über die Zeitumstellung am 25.10. hinweg
    const late = new Date('2026-10-22T08:00:00Z');
    expect(windowRange('week', late).to.toISOString()).toBe('2026-10-28T22:59:59.999Z');
  });

  it('berlinDayOffset zählt Kalendertage in Berlin', () => {
    const now = new Date('2026-10-06T21:30:00Z'); // 23:30 Berlin
    expect(berlinDayOffset('2026-10-06T22:30:00Z', now)).toBe(1); // 00:30 Berlin am 07.10.
    expect(berlinDayOffset('2026-10-06T20:00:00Z', now)).toBe(0);
  });

  it('minutesSince ist nie negativ', () => {
    const now = new Date('2026-10-06T10:00:00Z');
    expect(minutesSince('2026-10-06T09:47:10Z', now)).toBe(12);
    expect(minutesSince('2026-10-06T10:05:00Z', now)).toBe(0);
  });
});
