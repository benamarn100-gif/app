import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { SELF, type ProfileId } from '@/domain/profiles';
import { preferenceStorage } from '@/lib/storage';

/**
 * Für wen wird gerade gesucht? Nur auf dem Gerät gespeichert (Profil-ID, kein Name).
 * Steuert Fachrichtungs-Reihenfolge, Suchfilter und die Vorauswahl bei der Buchung.
 */
type State = { activeProfileId: ProfileId; setActiveProfile: (id: ProfileId) => void };

export const useActiveProfile = create<State>()(
  persist(
    (set) => ({
      activeProfileId: SELF,
      setActiveProfile: (id) => set({ activeProfileId: id }),
    }),
    {
      name: 'mednow.activeProfile.v1',
      storage: preferenceStorage,
      version: 1,
      partialize: ({ activeProfileId }) => ({ activeProfileId }),
    },
  ),
);
