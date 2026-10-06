import type { LatLng } from '../types';
import type { BBox } from './distance';

/**
 * Geohash (Base32) – identisch zu PostGIS ST_GeoHash. Realtime-Topics nutzen
 * Präzision 5 (Zellen ca. 4,9 × 4,9 km), damit die App nur Slot-Änderungen
 * im sichtbaren Kartenausschnitt abonniert.
 */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(point: LatLng, precision = 5): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (point.lng >= mid) {
        ch = (ch << 1) | 1;
        lngMin = mid;
      } else {
        ch <<= 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (point.lat >= mid) {
        ch = (ch << 1) | 1;
        latMin = mid;
      } else {
        ch <<= 1;
        latMax = mid;
      }
    }
    even = !even;
    if (++bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

export function decodeGeohashBounds(hash: string): BBox {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let even = true;
  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    if (idx < 0) throw new Error(`Ungültiges Geohash-Zeichen: ${c}`);
    for (let n = 4; n >= 0; n--) {
      const bitSet = (idx >> n) & 1;
      if (even) {
        const mid = (lngMin + lngMax) / 2;
        if (bitSet) lngMin = mid;
        else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitSet) latMin = mid;
        else latMax = mid;
      }
      even = !even;
    }
  }
  return { minLat: latMin, maxLat: latMax, minLng: lngMin, maxLng: lngMax };
}

/**
 * Alle Geohash-Zellen, die eine Bounding-Box überdecken. Gibt `null` zurück,
 * wenn mehr als `maxCells` nötig wären (dann lieber neu laden statt abonnieren).
 */
export function geohashesForBBox(box: BBox, precision = 5, maxCells = 12): string[] | null {
  const sample = decodeGeohashBounds(
    encodeGeohash({ lat: box.minLat, lng: box.minLng }, precision),
  );
  const cellH = sample.maxLat - sample.minLat;
  const cellW = sample.maxLng - sample.minLng;
  const rows = Math.ceil((box.maxLat - box.minLat) / cellH) + 1;
  const cols = Math.ceil((box.maxLng - box.minLng) / cellW) + 1;
  if (rows * cols > maxCells * 2) return null;
  const cells = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lat = Math.min(box.minLat + r * cellH, box.maxLat);
      const lng = Math.min(box.minLng + c * cellW, box.maxLng);
      cells.add(encodeGeohash({ lat, lng }, precision));
    }
  }
  return cells.size > maxCells ? null : [...cells];
}
