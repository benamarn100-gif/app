import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';

export const IDLE_LIMIT_MS = 30 * 60_000;
/** Vorwarnung vor der Abmeldung (WCAG 2.2.1: Zeitbegrenzung verlängerbar). */
export const IDLE_WARNING_MS = 60_000;
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * Meldet nach 30 Minuten ohne Eingabe ab (gemeinsam genutzte Praxisrechner).
 * Eine Minute vorher liefert der Hook `deadline`, damit die Oberfläche warnen und
 * „Angemeldet bleiben“ anbieten kann.
 */
export function useIdleSignOut(
  enabled: boolean,
  onIdle: () => void,
  limitMs = IDLE_LIMIT_MS,
  warningMs = IDLE_WARNING_MS,
) {
  const [deadline, setDeadline] = useState<number | null>(null);
  const last = useRef(0);
  const fire = useEffectEvent(onIdle);

  useEffect(() => {
    if (!enabled) return;
    last.current = Date.now();
    const mark = () => {
      last.current = Date.now();
      setDeadline(null);
    };
    for (const event of EVENTS) window.addEventListener(event, mark, { passive: true });
    const id = setInterval(
      () => {
        const idle = Date.now() - last.current;
        if (idle >= limitMs) {
          // Nur einmal auslösen – die Abmeldung läuft asynchron.
          last.current = Date.now();
          setDeadline(null);
          fire();
        } else if (idle >= limitMs - warningMs) {
          setDeadline(last.current + limitMs);
        }
      },
      Math.min(5_000, warningMs / 4),
    );
    return () => {
      clearInterval(id);
      for (const event of EVENTS) window.removeEventListener(event, mark);
    };
  }, [enabled, limitMs, warningMs]);

  const stay = useCallback(() => {
    last.current = Date.now();
    setDeadline(null);
  }, []);

  return { deadline: enabled ? deadline : null, stay };
}
