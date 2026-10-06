import { useEffect, useMemo, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';

import { useHoldSlot, useReleaseHold } from '@/data/hooks';
import { isAppError, type ErrorCode } from '@/data/repository';

/**
 * Hält den gewählten Slot 5 Minuten (Checkout) und gibt ihn beim Verlassen ohne
 * Buchung wieder frei. Ein Idempotenz-Schlüssel pro Buchungsvorgang verhindert
 * Doppelbuchungen bei Netzwerk-Wiederholungen.
 */
export function useSlotHold(slotId: string | undefined) {
  const hold = useHoldSlot();
  const release = useReleaseHold();
  const [heldUntil, setHeldUntil] = useState<string | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const booked = useRef(false);
  // Ein Schlüssel pro Slot und Buchungsvorgang
  const idempotencyKey = useMemo(() => (slotId ? Crypto.randomUUID() : ''), [slotId]);

  const acquire = async (id: string) => {
    try {
      const result = await hold.mutateAsync(id);
      setError(null);
      setHeldUntil(result.heldUntil);
    } catch (e) {
      setError(isAppError(e) ? e.code : 'unknown');
    }
  };

  useEffect(() => {
    if (!slotId) return;
    booked.current = false;
    let active = true;
    hold.mutateAsync(slotId).then(
      (result) => {
        if (!active) return;
        setError(null);
        setHeldUntil(result.heldUntil);
      },
      (e: unknown) => {
        if (active) setError(isAppError(e) ? e.code : 'unknown');
      },
    );
    return () => {
      active = false;
      if (!booked.current) release.mutate(slotId);
    };
  }, [slotId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    heldUntil,
    error,
    holding: hold.isPending,
    idempotencyKey,
    retry: () => slotId && acquire(slotId),
    markBooked: () => {
      booked.current = true;
    },
  };
}
