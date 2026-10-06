import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/**
 * Persistenz für nicht-sensible Präferenzen und den Offline-Cache öffentlicher Daten.
 * Sensible Daten (Auth-Session) liegen verschlüsselt, siehe src/data/supabase/sessionStorage.ts.
 */
export const preferenceStorage = createJSONStorage(() => AsyncStorage);

export { AsyncStorage };
