/**
 * Browser-Speicher mit Absicherung (privater Modus, Tests). `local` nur für
 * Einstellungen wie die Sprache; Anmeldung und Demo-Zustand liegen in `session`
 * und enden mit dem Tab.
 */
export function readStorage(key: string, storage: 'session' | 'local' = 'local'): string | null {
  try {
    return (storage === 'session' ? window.sessionStorage : window.localStorage).getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(
  key: string,
  value: string | null,
  storage: 'session' | 'local' = 'local',
): void {
  try {
    const target = storage === 'session' ? window.sessionStorage : window.localStorage;
    if (value === null) target.removeItem(key);
    else target.setItem(key, value);
  } catch {
    // Speicher nicht verfügbar – Einstellung gilt nur bis zum Neuladen.
  }
}
