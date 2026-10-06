import { create } from 'zustand';

import type { AccessibilityFeature, TimeWindow } from '@/domain/types';

import type { InsuranceFilter } from '@/data/repository';

export type SearchFilters = {
  text: string;
  specialtyIds: number[];
  radiusKm: number;
  window: TimeWindow;
  languages: string[];
  accessibility: AccessibilityFeature[];
  insurance: InsuranceFilter;
  videoOnly: boolean;
};

export const RADIUS_STEPS = [1, 2, 5, 10, 15, 25, 50] as const;

export const DEFAULT_FILTERS: SearchFilters = {
  text: '',
  specialtyIds: [],
  radiusKm: 10,
  window: 'week',
  languages: [],
  accessibility: [],
  insurance: 'any',
  videoOnly: false,
};

type Store = SearchFilters & {
  set: (patch: Partial<SearchFilters>) => void;
  reset: (radiusKm?: number) => void;
};

/** Filter der Suche (Sitzung). Der Standard-Umkreis kommt aus den Einstellungen. */
export const useSearchFilters = create<Store>((set) => ({
  ...DEFAULT_FILTERS,
  set: (patch) => set(patch),
  reset: (radiusKm) => set({ ...DEFAULT_FILTERS, radiusKm: radiusKm ?? DEFAULT_FILTERS.radiusKm }),
}));

/** Anzahl aktiver Filter (ohne Text und Umkreis) für das Filter-Badge. */
export function activeFilterCount(f: SearchFilters): number {
  return (
    (f.specialtyIds.length ? 1 : 0) +
    (f.window !== DEFAULT_FILTERS.window ? 1 : 0) +
    f.languages.length +
    f.accessibility.length +
    (f.insurance !== 'any' ? 1 : 0) +
    (f.videoOnly ? 1 : 0)
  );
}

/** Nächster größerer Umkreis für „Radius erweitern“. */
export function nextRadius(current: number): number | null {
  const next = RADIUS_STEPS.find((r) => r > current);
  return next ?? null;
}
