import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ThemePreference } from '@/design/theme';
import type { AgeGroup } from '@/domain/types';
import type { LanguagePreference } from '@/i18n';
import { preferenceStorage } from '@/lib/storage';

/**
 * Gespeicherter Suchort. Gerätestandort wird NICHT gespeichert – nur die Wahl,
 * ihn zu verwenden; Koordinaten werden pro Sitzung frisch ermittelt.
 */
export type SavedLocation =
  { kind: 'device' } | { kind: 'postal'; postalCode: string; lat: number; lng: number };

export type Preferences = {
  onboardingCompleted: boolean;
  location: SavedLocation | null;
  forWhom: 'self' | 'child';
  ageGroup: AgeGroup | null;
  favoriteSpecialtyIds: number[];
  radiusKm: number;
  theme: ThemePreference;
  language: LanguagePreference;
  formalAddress: boolean;
  haptics: boolean;
  remindersEnabled: boolean;
  crashReportsOptIn: boolean;
};

type Actions = {
  set: (patch: Partial<Preferences>) => void;
  completeOnboarding: () => void;
  toggleFavoriteSpecialty: (id: number) => void;
  reset: () => void;
};

export const DEFAULT_PREFERENCES: Preferences = {
  onboardingCompleted: false,
  location: null,
  forWhom: 'self',
  ageGroup: null,
  favoriteSpecialtyIds: [],
  radiusKm: 10,
  theme: 'system',
  language: 'system',
  formalAddress: false,
  haptics: true,
  remindersEnabled: true,
  crashReportsOptIn: false,
};

export const usePreferences = create<Preferences & Actions>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      set: (patch) => set(patch),
      completeOnboarding: () => set({ onboardingCompleted: true }),
      toggleFavoriteSpecialty: (id) =>
        set((s) => ({
          favoriteSpecialtyIds: s.favoriteSpecialtyIds.includes(id)
            ? s.favoriteSpecialtyIds.filter((x) => x !== id)
            : [...s.favoriteSpecialtyIds, id],
        })),
      reset: () => set(DEFAULT_PREFERENCES),
    }),
    {
      name: 'mednow.preferences.v1',
      storage: preferenceStorage,
      version: 1,
      partialize: ({
        set: _set,
        completeOnboarding: _c,
        toggleFavoriteSpecialty: _t,
        reset: _r,
        ...rest
      }) => rest,
    },
  ),
);

/** Wartet, bis der persistierte Zustand geladen ist (für Splash/Redirect). */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => usePreferences.persist.onFinishHydration(onChange),
    () => usePreferences.persist.hasHydrated(),
    () => false,
  );
}
