import { cities } from '../../config/city';
import { distanceMeters } from '../geo/distance';
import { SPECIALTIES } from '../seed/catalog';
import { generateDirectory, generateSlots, syncTimestamps } from '../seed/generator';
import { uuidFromString } from '../seed/random';

describe('Seed-Generator', () => {
  const directory = generateDirectory(cities.fulda);
  const now = new Date('2026-10-06T06:30:00Z'); // Di 08:30 Berlin
  const slots = generateSlots(directory, now, 14);

  it('erzeugt rund 60 fiktive Praxen in 12 Fachrichtungen', () => {
    expect(directory.practices).toHaveLength(60);
    const used = new Set(directory.practices.flatMap((p) => p.specialtyIds));
    expect(SPECIALTIES.every((s) => used.has(s.id))).toBe(true);
    expect(directory.practices.every((p) => p.isDemo && p.source === 'seed')).toBe(true);
  });

  it('ist deterministisch (gleiche IDs und Namen bei gleichem Seed)', () => {
    const again = generateDirectory(cities.fulda);
    expect(again.practices.map((p) => [p.id, p.name])).toEqual(
      directory.practices.map((p) => [p.id, p.name]),
    );
    expect(generateSlots(again, now, 14).map((s) => s.id)).toEqual(slots.map((s) => s.id));
  });

  it('verteilt Praxen im konfigurierten Umkreis', () => {
    for (const p of directory.practices) {
      expect(distanceMeters(cities.fulda.center, p.location)).toBeLessThanOrEqual(
        cities.fulda.spreadKm * 1000 + 1,
      );
      expect(cities.fulda.postalCodes).toContain(p.address.postalCode);
    }
  });

  it('nutzt fiktive Rufnummern aus dem reservierten Bereich', () => {
    expect(directory.practices.every((p) => p.phone?.startsWith('+49 69 90009 '))).toBe(true);
  });

  it('erzeugt Slots für 14 Tage ohne Überschneidung pro Arzt', () => {
    const last = Math.max(...slots.map((s) => Date.parse(s.startsAt)));
    expect(last - now.getTime()).toBeGreaterThan(12 * 24 * 3600 * 1000);
    const byDoctor = new Map<string, typeof slots>();
    for (const s of slots) byDoctor.set(s.doctorId, [...(byDoctor.get(s.doctorId) ?? []), s]);
    for (const list of byDoctor.values()) {
      const sorted = [...list].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
      for (let i = 1; i < sorted.length; i++) {
        expect(Date.parse(sorted[i]!.startsAt)).toBeGreaterThanOrEqual(
          Date.parse(sorted[i - 1]!.endsAt),
        );
      }
    }
  });

  it('hat eine realistische Mischung aus offenen und gebuchten Slots', () => {
    const open = slots.filter((s) => s.status === 'open').length;
    const ratio = open / slots.length;
    expect(ratio).toBeGreaterThan(0.1);
    expect(ratio).toBeLessThan(0.5);
  });

  it('einige Praxen haben veraltete Daten (Status „Unbekannt“)', () => {
    const synced = syncTimestamps(directory, now);
    const stale = [...synced.values()].filter(
      (iso) => now.getTime() - Date.parse(iso) > 24 * 3600 * 1000,
    );
    expect(stale.length).toBeGreaterThanOrEqual(1);
    expect(stale.length).toBeLessThan(10);
  });

  it('uuidFromString erzeugt gültige UUIDs', () => {
    expect(uuidFromString('x')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
