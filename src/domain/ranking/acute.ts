import type { PracticeAvailability } from '../types';

/**
 * Ranking im Akut-Modus (Vorgabe): frühester freier Slot, dann Entfernung, dann Bewertung.
 * Praxen mit Status „unknown“ stehen getrennt am Ende (Anrufen statt Buchen),
 * Praxen ohne freien Slot ebenfalls hinten. Stabil über den Namen.
 */
export function compareAcute(a: PracticeAvailability, b: PracticeAvailability): number {
  const groupA = acuteGroup(a);
  const groupB = acuteGroup(b);
  if (groupA !== groupB) return groupA - groupB;

  const slotA = a.nextSlot ? Date.parse(a.nextSlot.startsAt) : Number.POSITIVE_INFINITY;
  const slotB = b.nextSlot ? Date.parse(b.nextSlot.startsAt) : Number.POSITIVE_INFINITY;
  if (slotA !== slotB) return slotA - slotB;

  const distA = a.distanceM ?? Number.POSITIVE_INFINITY;
  const distB = b.distanceM ?? Number.POSITIVE_INFINITY;
  if (distA !== distB) return distA - distB;

  const ratingA = a.practice.rating?.average ?? Number.NEGATIVE_INFINITY;
  const ratingB = b.practice.rating?.average ?? Number.NEGATIVE_INFINITY;
  if (ratingA !== ratingB) return ratingB - ratingA;

  return a.practice.name.localeCompare(b.practice.name, 'de');
}

/** 0 = buchbarer Slot, 1 = bekannt, aber nichts frei, 2 = unbekannt */
function acuteGroup(item: PracticeAvailability): number {
  if (item.status === 'unknown') return 2;
  return item.nextSlot ? 0 : 1;
}

export function rankAcute(items: readonly PracticeAvailability[]): PracticeAvailability[] {
  return [...items].sort(compareAcute);
}

/** Standardsortierung der Suche: Status (frei vor wenige vor ausgebucht vor unbekannt), dann Entfernung. */
const STATUS_ORDER = { free: 0, few: 1, booked: 2, unknown: 3 } as const;

export function compareByDistance(a: PracticeAvailability, b: PracticeAvailability): number {
  const distA = a.distanceM ?? Number.POSITIVE_INFINITY;
  const distB = b.distanceM ?? Number.POSITIVE_INFINITY;
  if (distA !== distB) return distA - distB;
  return a.practice.name.localeCompare(b.practice.name, 'de');
}

export function compareRelevance(a: PracticeAvailability, b: PracticeAvailability): number {
  const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (s !== 0) return s;
  return compareByDistance(a, b);
}
