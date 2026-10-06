import { useEffect, useEffectEvent } from 'react';

export const IDLE_LIMIT_MS = 30 * 60_000;
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/** Meldet nach 30 Minuten ohne Eingabe ab (gemeinsam genutzte Praxisrechner). */
export function useIdleSignOut(enabled: boolean, onIdle: () => void, limitMs = IDLE_LIMIT_MS) {
  const fire = useEffectEvent(onIdle);
  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    const mark = () => {
      last = Date.now();
    };
    for (const event of EVENTS) window.addEventListener(event, mark, { passive: true });
    const id = setInterval(
      () => {
        if (Date.now() - last >= limitMs) fire();
      },
      Math.min(30_000, limitMs),
    );
    return () => {
      clearInterval(id);
      for (const event of EVENTS) window.removeEventListener(event, mark);
    };
  }, [enabled, limitMs]);
}
