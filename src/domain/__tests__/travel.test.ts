import { estimateTravelMinutes, isWalkable, leaveAt } from '../geo/travel';

describe('Wegezeit (Schätzung aus Luftlinie)', () => {
  it('zu Fuß: 1 km Luftlinie ≈ 1,3 km Weg ≈ 17 Min. → 20 (5-Minuten-Schritte ab 10)', () => {
    expect(estimateTravelMinutes(1000, 'walk')).toBe(20);
  });

  it('Auto: 5 km Luftlinie ≈ 6,5 km bei 30 km/h + 3 Min. Parken ≈ 16 → 20', () => {
    expect(estimateTravelMinutes(5000, 'car')).toBe(20);
  });

  it('kurze Wege in ganzen Minuten, nie 0', () => {
    expect(estimateTravelMinutes(100, 'walk')).toBe(2);
    expect(estimateTravelMinutes(0, 'walk')).toBe(1);
  });

  it('ÖPNV: keine Schätzung ohne Fahrplandaten', () => {
    expect(estimateTravelMinutes(3000, 'transit')).toBeNull();
  });

  it('ungültige Entfernung → keine Schätzung', () => {
    expect(estimateTravelMinutes(Number.NaN, 'car')).toBeNull();
    expect(estimateTravelMinutes(-5, 'car')).toBeNull();
  });

  it('zu Fuß nur bis ca. 45 Minuten', () => {
    expect(isWalkable(2000)).toBe(true);
    expect(isWalkable(4000)).toBe(false);
  });

  it('„Jetzt losfahren“: Wegezeit + 10 Min. Puffer, mindestens 15 Min. vorher', () => {
    const start = new Date('2026-10-07T08:00:00Z');
    // Auto 5 km: 20 Min. + 10 → 30 Min. vorher
    expect(leaveAt(start, 5000, 'car').toISOString()).toBe('2026-10-07T07:30:00.000Z');
    // sehr nah: mindestens 15 Min.
    expect(leaveAt(start, 50, 'walk').toISOString()).toBe('2026-10-07T07:45:00.000Z');
    // ÖPNV: (20 × 2 + 10) + 10 = 60 Min.
    expect(leaveAt(start, 5000, 'transit').toISOString()).toBe('2026-10-07T07:00:00.000Z');
  });
});
