import type { SearchParams } from './repository';

/**
 * Query-Keys. Nur öffentliche Schlüssel ('availability', 'practice', 'slots') werden
 * offline gecacht – alles unter 'me' (persönliche Daten) nie.
 */
export const PERSISTED_ROOTS = ['availability', 'practice', 'slots'] as const;

export const queryKeys = {
  search: (p: SearchParams) =>
    [
      'availability',
      'search',
      {
        lat: Math.round(p.center.lat * 1000) / 1000,
        lng: Math.round(p.center.lng * 1000) / 1000,
        radiusKm: p.radiusKm,
        window: p.window,
        specialtyIds: [...p.specialtyIds].sort(),
        languages: [...p.languages].sort(),
        accessibility: [...p.accessibility].sort(),
        insurance: p.insurance,
        videoOnly: p.videoOnly,
        text: p.text.trim().toLowerCase(),
      },
    ] as const,
  practice: (id: string) => ['practice', id] as const,
  slots: (practiceId: string, fromDay: string) => ['slots', practiceId, fromDay] as const,
  slotsAll: (practiceId: string) => ['slots', practiceId] as const,
  appointments: ['me', 'appointments'] as const,
  dependents: ['me', 'dependents'] as const,
  contact: ['me', 'contact'] as const,
  waitlist: ['me', 'waitlist'] as const,
  offers: ['me', 'offers'] as const,
  consents: ['me', 'consents'] as const,
  session: ['me', 'session'] as const,
  plan: ['me', 'plan'] as const,
};
