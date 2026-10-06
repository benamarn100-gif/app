import type { LatLng } from '../types';

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Großkreisentfernung in Metern (Haversine). Genau genug für Umkreissuche bis 50 km. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Standort datensparsam runden, bevor er das Gerät verlässt.
 * 3 Nachkommastellen ≈ 110 m (Suche), 2 ≈ 1,1 km (gespeicherter Heimatort).
 */
export function roundLocation(point: LatLng, decimals: 2 | 3 = 3): LatLng {
  const f = 10 ** decimals;
  return { lat: Math.round(point.lat * f) / f, lng: Math.round(point.lng * f) / f };
}

/** Punkt in gegebener Entfernung (m) und Peilung (Grad) – für Seed und Tests. */
export function destinationPoint(origin: LatLng, distanceM: number, bearingDeg: number): LatLng {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(origin.lat);
  const λ1 = toRad(origin.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: (φ2 * 180) / Math.PI, lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180 };
}

export type BBox = { minLat: number; minLng: number; maxLat: number; maxLng: number };

export function bboxContains(box: BBox, p: LatLng): boolean {
  return p.lat >= box.minLat && p.lat <= box.maxLat && p.lng >= box.minLng && p.lng <= box.maxLng;
}
