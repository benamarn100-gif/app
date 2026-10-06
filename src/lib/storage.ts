import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/**
 * Persistenz für nicht-sensible Präferenzen, den Offline-Cache öffentlicher Daten und
 * den Demo-Zustand. Sensible Daten (Auth-Session) liegen verschlüsselt, siehe
 * src/data/supabase/secureSessionStorage.ts.
 */
export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/**
 * Speicher, der nie wirft: Ist der Gerätespeicher nicht nutzbar (im Browser blockiert,
 * voll, privater Modus), arbeitet die App mit einer Kopie im Arbeitsspeicher weiter –
 * Einstellungen gelten dann nur bis zum Neustart. Ohne diesen Schutz bliebe die App
 * beim Laden der Einstellungen hängen (Startbildschirm).
 */
export function createSafeStorage(backend: KeyValueStorage): KeyValueStorage {
  const memory = new Map<string, string>();
  let available = true;

  async function attempt<T>(operation: () => Promise<T>, fallback: () => T): Promise<T> {
    if (!available) return fallback();
    try {
      return await operation();
    } catch {
      available = false;
      return fallback();
    }
  }

  return {
    getItem: (key) =>
      attempt(
        () => backend.getItem(key),
        () => memory.get(key) ?? null,
      ),
    setItem: (key, value) => {
      memory.set(key, value);
      return attempt(
        () => backend.setItem(key, value),
        () => undefined,
      );
    },
    removeItem: (key) => {
      memory.delete(key);
      return attempt(
        () => backend.removeItem(key),
        () => undefined,
      );
    },
  };
}

export const appStorage = createSafeStorage(AsyncStorage);
export const preferenceStorage = createJSONStorage(() => appStorage);
