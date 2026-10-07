/**
 * Grobe Wegezeit aus der Luftlinie (Feature 3). Ohne Routing-Dienst – deshalb in der App
 * immer als „ca.“ angezeigt; die genaue Zeit liefert die Karten-App über „Route“.
 *
 * Annahmen (Stadt/Kleinstadt):
 *  - Umwegfaktor Straße/Luftlinie 1,3
 *  - zu Fuß 4,8 km/h
 *  - Auto im Ort ⌀ 30 km/h + 3 Minuten für Parken
 *  - ÖPNV: keine Schätzung ohne Fahrplandaten (`null`) – nur Route in der Karten-App
 */
export type TravelMode = 'walk' | 'car' | 'transit';

export const TRAVEL_MODES: readonly TravelMode[] = ['walk', 'car', 'transit'];

const DETOUR = 1.3;
const WALK_M_PER_MIN = 4800 / 60;
const CAR_M_PER_MIN = 30000 / 60;
const PARKING_MIN = 3;

/** Geschätzte Minuten (gerundet, mindestens 1) oder `null`, wenn keine seriöse Schätzung möglich ist. */
export function estimateTravelMinutes(distanceM: number, mode: TravelMode): number | null {
  if (!Number.isFinite(distanceM) || distanceM < 0) return null;
  const road = distanceM * DETOUR;
  switch (mode) {
    case 'walk':
      return roundMinutes(road / WALK_M_PER_MIN);
    case 'car':
      return roundMinutes(road / CAR_M_PER_MIN + PARKING_MIN);
    case 'transit':
      return null;
  }
}

/** Zu Fuß ist ab ca. 45 Minuten keine sinnvolle Option mehr – dann nicht anzeigen. */
export function isWalkable(distanceM: number): boolean {
  const minutes = estimateTravelMinutes(distanceM, 'walk');
  return minutes !== null && minutes <= 45;
}

/**
 * Zeitpunkt für „Jetzt losfahren“ (Feature 4): Wegezeit + 10 Minuten Puffer vor Termin.
 * ÖPNV ohne Fahrplan: doppelte Autozeit + 10 Minuten als vorsichtige Schätzung.
 * Mindestens 15 Minuten vorher.
 */
export function leaveAt(startsAt: Date, distanceM: number, mode: TravelMode): Date {
  const travel =
    mode === 'transit'
      ? (estimateTravelMinutes(distanceM, 'car') ?? 15) * 2 + 10
      : (estimateTravelMinutes(distanceM, mode) ?? 15);
  const lead = Math.max(15, travel + 10);
  return new Date(startsAt.getTime() - lead * 60_000);
}

function roundMinutes(min: number): number {
  if (min < 10) return Math.max(1, Math.ceil(min));
  return Math.ceil(min / 5) * 5;
}
