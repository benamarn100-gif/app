import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { preferenceStorage } from '@/lib/storage';

/**
 * Vorsorge-Erinnerungen (Feature 7) – ausschließlich auf diesem Gerät.
 * Gesundheitsbezogen: erst nach Einwilligung (consentAt) wird etwas gespeichert;
 * gespeichert werden nur Profil-ID, Untersuchungs-ID und Fälligkeitsdatum.
 */
export type CheckupReminder = { dueAt: string };

type State = {
  consentAt: string | null;
  reminders: Record<string, CheckupReminder>;
  setConsent: () => void;
  setReminder: (key: string, reminder: CheckupReminder) => void;
  removeReminder: (key: string) => void;
  /** Widerruf: alles löschen */
  clear: () => void;
};

export const useCheckups = create<State>()(
  persist(
    (set) => ({
      consentAt: null,
      reminders: {},
      setConsent: () => set({ consentAt: new Date().toISOString() }),
      setReminder: (key, reminder) =>
        set((s) => ({ reminders: { ...s.reminders, [key]: reminder } })),
      removeReminder: (key) =>
        set((s) => {
          const { [key]: _removed, ...reminders } = s.reminders;
          return { reminders };
        }),
      clear: () => set({ consentAt: null, reminders: {} }),
    }),
    {
      name: 'mednow.checkups.v1',
      storage: preferenceStorage,
      version: 1,
      partialize: ({ consentAt, reminders }) => ({ consentAt, reminders }),
    },
  ),
);
