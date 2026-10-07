import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { preferenceStorage } from '@/lib/storage';

/**
 * Gemerkte Praxen (Feature 6) – nur auf diesem Gerät, nicht auf dem Server.
 * Nutzen: Die eigene Hausarztpraxis ist immer einen Tipp entfernt.
 */
type State = {
  practiceIds: string[];
  toggle: (practiceId: string) => boolean;
  clear: () => void;
};

export const MAX_FAVORITES = 20;

export const useFavorites = create<State>()(
  persist(
    (set, get) => ({
      practiceIds: [],
      toggle: (practiceId) => {
        const has = get().practiceIds.includes(practiceId);
        set({
          practiceIds: has
            ? get().practiceIds.filter((id) => id !== practiceId)
            : [practiceId, ...get().practiceIds].slice(0, MAX_FAVORITES),
        });
        return !has;
      },
      clear: () => set({ practiceIds: [] }),
    }),
    {
      name: 'mednow.favorites.v1',
      storage: preferenceStorage,
      version: 1,
      partialize: ({ practiceIds }) => ({ practiceIds }),
    },
  ),
);
