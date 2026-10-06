import { useMemo } from 'react';

import type { SearchParams } from '@/data/repository';
import { useSearchCenter } from '@/data/hooks';
import type { TimeWindow } from '@/domain/types';
import { usePreferences } from '@/state/preferences';
import { useSearchFilters } from '@/state/searchFilters';

/** Suchparameter aus Mittelpunkt + aktiven Filtern (Suche-Tab). */
export function useFilteredSearchParams(): {
  params: SearchParams | null;
  center: ReturnType<typeof useSearchCenter>;
} {
  const center = useSearchCenter();
  const filters = useSearchFilters();
  const params = useMemo<SearchParams | null>(
    () =>
      center.center
        ? {
            center: center.center,
            radiusKm: filters.radiusKm,
            window: filters.window,
            specialtyIds: filters.specialtyIds,
            languages: filters.languages,
            accessibility: filters.accessibility,
            insurance: filters.insurance,
            videoOnly: filters.videoOnly,
            text: filters.text,
          }
        : null,
    [center.center, filters],
  );
  return { params, center };
}

/** Einfache Suchparameter (Home, Akut-Modus): Umkreis aus Einstellungen, ohne Filter. */
export function useBasicSearchParams(
  window: TimeWindow,
  radiusOverride?: number,
  specialtyIds: number[] = [],
) {
  const center = useSearchCenter();
  const radius = usePreferences((s) => s.radiusKm);
  const key = specialtyIds.join(',');
  const params = useMemo<SearchParams | null>(
    () =>
      center.center
        ? {
            center: center.center,
            radiusKm: radiusOverride ?? radius,
            window,
            specialtyIds: key ? key.split(',').map(Number) : [],
            languages: [],
            accessibility: [],
            insurance: 'any',
            videoOnly: false,
            text: '',
          }
        : null,
    [center.center, radius, radiusOverride, window, key],
  );
  return { params, center };
}
