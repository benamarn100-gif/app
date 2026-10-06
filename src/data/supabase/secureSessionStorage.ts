import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Speichert die Supabase-Sitzung im Schlüsselbund (iOS Keychain / Android Keystore).
 * SecureStore-Werte sollten < 2 KB sein – daher in Stücke aufgeteilt.
 * Web (nur Entwicklungs-Vorschau): sessionStorage, damit nichts dauerhaft liegen bleibt.
 */
const CHUNK = 1800;
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.sessionStorage?.getItem(key) ?? null;
    const base = safeKey(key);
    const count = Number(await SecureStore.getItemAsync(`${base}.n`, OPTIONS));
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${base}.${i}`, OPTIONS);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.sessionStorage?.setItem(key, value);
      return;
    }
    const base = safeKey(key);
    await this.removeItem(key);
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        `${base}.${i}`,
        value.slice(i * CHUNK, (i + 1) * CHUNK),
        OPTIONS,
      );
    }
    await SecureStore.setItemAsync(`${base}.n`, String(count), OPTIONS);
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.sessionStorage?.removeItem(key);
      return;
    }
    const base = safeKey(key);
    const count = Number(await SecureStore.getItemAsync(`${base}.n`, OPTIONS));
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${base}.${i}`, OPTIONS);
    await SecureStore.deleteItemAsync(`${base}.n`, OPTIONS);
  },
};
