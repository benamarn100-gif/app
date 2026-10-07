import { SPECIALTIES, specialtyBySlug } from './seed/catalog';
import type { AgeGroup, Dependent, Specialty } from './types';

/**
 * Familienprofile (Feature 5): „Ich“ plus Familienmitglieder mit Spitzname und Altersgruppe
 * (kein Geburtsdatum – Datensparsamkeit). Das aktive Profil passt Suche und Buchung an.
 * Nutzen: Eltern suchen und buchen für ihr Kind, ohne jedes Mal umzudenken – die passende
 * Fachrichtung steht vorn, der Termin ist dem Kind zugeordnet.
 *
 * Keine medizinische Empfehlung: Wir sortieren nur um und tauschen die allgemeine
 * Fachrichtung gegen die altersgerechte (Hausarzt ↔ Kinder- und Jugendarzt).
 */
export const SELF = 'self' as const;
export type ProfileId = typeof SELF | string;

export type Profile = { id: ProfileId; label: string; ageGroup: AgeGroup | null };

export const MINOR_GROUPS: readonly AgeGroup[] = ['child_0_5', 'child_6_12', 'teen_13_17'];

export function isMinor(ageGroup: AgeGroup | null | undefined): boolean {
  return !!ageGroup && MINOR_GROUPS.includes(ageGroup);
}

export function profilesFrom(
  selfLabel: string,
  selfAgeGroup: AgeGroup | null,
  dependents: readonly Dependent[],
): Profile[] {
  return [
    { id: SELF, label: selfLabel, ageGroup: selfAgeGroup },
    ...dependents.map((d) => ({ id: d.id, label: d.label, ageGroup: d.ageGroup })),
  ];
}

const GENERAL = specialtyBySlug('allgemeinmedizin')!.id;
const PEDIATRIC = specialtyBySlug('kinder-jugendmedizin')!.id;

/** Fachrichtungen in altersgerechter Reihenfolge: Kinder → Kinder- und Jugendmedizin zuerst. */
export function specialtiesFor(ageGroup: AgeGroup | null): Specialty[] {
  if (!isMinor(ageGroup)) {
    // Erwachsene: Kinder- und Jugendmedizin ans Ende
    return [...SPECIALTIES].sort((a, b) => Number(a.id === PEDIATRIC) - Number(b.id === PEDIATRIC));
  }
  return [...SPECIALTIES].sort((a, b) => Number(b.id === PEDIATRIC) - Number(a.id === PEDIATRIC));
}

/** Hausarzt ↔ Kinder- und Jugendarzt beim Profilwechsel tauschen, sonst unverändert. */
export function adaptSpecialtyIds(ids: readonly number[], ageGroup: AgeGroup | null): number[] {
  const minor = isMinor(ageGroup);
  const out = ids.map((id) => {
    if (minor && id === GENERAL) return PEDIATRIC;
    if (!minor && ageGroup && id === PEDIATRIC) return GENERAL;
    return id;
  });
  return [...new Set(out)];
}
