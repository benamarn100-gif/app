import { windowRange } from '../time/berlin';
import type { AvailabilityStatus, Slot, TimeWindow } from '../types';

/** Daten älter als 24 h gelten als unzuverlässig → Status „Unbekannt“. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
export const FREE_THRESHOLD = 3;

/**
 * Ein Slot ist buchbar, wenn er offen ist oder ein Halten abgelaufen ist
 * (Ablauf wird serverseitig per Job bereinigt, clientseitig nicht darauf warten).
 */
export function isSlotBookable(slot: Slot, now: Date): boolean {
  if (new Date(slot.startsAt).getTime() <= now.getTime()) return false;
  if (slot.status === 'open') return true;
  if (slot.status === 'held' && slot.heldUntil) {
    return new Date(slot.heldUntil).getTime() <= now.getTime();
  }
  return false;
}

export function isStale(lastSyncedAt: string | null, now: Date): boolean {
  if (!lastSyncedAt) return true;
  return now.getTime() - new Date(lastSyncedAt).getTime() > STALE_AFTER_MS;
}

/**
 * Statusregel (Vorgabe):
 * keine/veraltete Daten (> 24 h) → unknown · ≥ 3 offene Slots → free · 1–2 → few · 0 → booked
 */
export function statusFromCount(
  openCount: number,
  lastSyncedAt: string | null,
  now: Date,
): AvailabilityStatus {
  if (isStale(lastSyncedAt, now)) return 'unknown';
  if (openCount >= FREE_THRESHOLD) return 'free';
  if (openCount >= 1) return 'few';
  return 'booked';
}

export type WindowSummary = {
  status: AvailabilityStatus;
  openCount: number;
  nextSlot: Slot | null;
};

/** Fasst die Slots eines Arztes oder einer Praxis für ein Zeitfenster zusammen. */
export function summarizeSlots(
  slots: readonly Slot[],
  window: TimeWindow,
  lastSyncedAt: string | null,
  now: Date,
): WindowSummary {
  const { from, to } = windowRange(window, now);
  const fromMs = from.getTime();
  const toMs = to.getTime();
  let openCount = 0;
  let nextSlot: Slot | null = null;
  for (const slot of slots) {
    if (!isSlotBookable(slot, now)) continue;
    const start = new Date(slot.startsAt).getTime();
    if (start < fromMs || start > toMs) continue;
    openCount++;
    if (!nextSlot || start < new Date(nextSlot.startsAt).getTime()) nextSlot = slot;
  }
  const stale = isStale(lastSyncedAt, now);
  return {
    status: statusFromCount(openCount, lastSyncedAt, now),
    openCount: stale ? 0 : openCount,
    nextSlot: stale ? null : nextSlot,
  };
}

/** Frühester buchbarer Slot ab jetzt (ohne Fenstergrenze), z. B. für „frühestens morgen 08:15“. */
export function earliestBookable(slots: readonly Slot[], now: Date): Slot | null {
  let best: Slot | null = null;
  for (const slot of slots) {
    if (!isSlotBookable(slot, now)) continue;
    if (!best || new Date(slot.startsAt).getTime() < new Date(best.startsAt).getTime()) best = slot;
  }
  return best;
}
