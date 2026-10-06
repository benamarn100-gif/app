import { useEffect, useState } from 'react';

let override: Date | null = null;

/** Nur für Tests/Showcase: feste „Jetzt“-Zeit. */
export function setNowOverride(date: Date | null) {
  override = date;
}

export function getNow(): Date {
  return override ? new Date(override) : new Date();
}

/** Aktuelle Zeit, die sich alle `intervalMs` aktualisiert (für Countdown/„vor X Min.“). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(getNow);
  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
