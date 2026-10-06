import { destinationPoint, distanceMeters, roundLocation } from '../geo/distance';
import { decodeGeohashBounds, encodeGeohash, geohashesForBBox } from '../geo/geohash';

describe('Geo', () => {
  it('Entfernung Fulda Dom → Bahnhof ≈ 1 km', () => {
    const dom = { lat: 50.5539, lng: 9.6723 };
    const bahnhof = { lat: 50.5546, lng: 9.6844 };
    expect(distanceMeters(dom, bahnhof)).toBeGreaterThan(800);
    expect(distanceMeters(dom, bahnhof)).toBeLessThan(900);
  });

  it('destinationPoint ist konsistent mit distanceMeters', () => {
    const origin = { lat: 50.5558, lng: 9.6808 };
    const p = destinationPoint(origin, 5000, 73);
    expect(distanceMeters(origin, p)).toBeCloseTo(5000, 0);
  });

  it('roundLocation rundet datensparsam', () => {
    expect(roundLocation({ lat: 50.555812, lng: 9.680834 })).toEqual({ lat: 50.556, lng: 9.681 });
    expect(roundLocation({ lat: 50.555812, lng: 9.680834 }, 2)).toEqual({ lat: 50.56, lng: 9.68 });
  });

  it('Geohash entspricht der Referenz (PostGIS ST_GeoHash)', () => {
    expect(encodeGeohash({ lat: 57.64911, lng: 10.40744 }, 11)).toBe('u4pruydqqvj');
    expect(encodeGeohash({ lat: 50.5558, lng: 9.6808 }, 5)).toBe('u0yzs');
  });

  it('decodeGeohashBounds enthält den Ursprungspunkt', () => {
    const p = { lat: 50.5558, lng: 9.6808 };
    const b = decodeGeohashBounds(encodeGeohash(p, 5));
    expect(p.lat).toBeGreaterThanOrEqual(b.minLat);
    expect(p.lat).toBeLessThanOrEqual(b.maxLat);
    expect(p.lng).toBeGreaterThanOrEqual(b.minLng);
    expect(p.lng).toBeLessThanOrEqual(b.maxLng);
  });

  it('geohashesForBBox deckt einen Stadtausschnitt mit wenigen Zellen ab', () => {
    const cells = geohashesForBBox({ minLat: 50.52, maxLat: 50.59, minLng: 9.62, maxLng: 9.74 });
    expect(cells).not.toBeNull();
    expect(cells!.length).toBeGreaterThan(0);
    expect(cells!.length).toBeLessThanOrEqual(12);
    expect(cells).toContain(encodeGeohash({ lat: 50.5558, lng: 9.6808 }, 5));
  });

  it('geohashesForBBox gibt null für sehr große Ausschnitte zurück', () => {
    expect(geohashesForBBox({ minLat: 47, maxLat: 55, minLng: 6, maxLng: 15 })).toBeNull();
  });
});
