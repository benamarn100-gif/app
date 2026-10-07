import type { AgeGroup } from './types';

/**
 * Vorsorge-Übersicht (Feature 7): Früherkennungs- und Vorsorgeuntersuchungen, die die
 * gesetzliche Krankenversicherung übernimmt. Nur Information + selbst gewählte Erinnerung –
 * keine medizinische Empfehlung, keine Auswertung.
 * Nutzen: Niemand muss sich merken, wann die nächste Vorsorge dran ist.
 *
 * Stand 10/2026 (Verbraucherzentrale, Bundesgesundheitsministerium, G-BA-Richtlinien).
 * Vor Launch fachlich prüfen lassen (docs/release-notes-2026-10.md, offene Punkte).
 * Geschlecht wird nicht gespeichert: geschlechtsspezifische Angebote stehen in eigenen
 * Abschnitten, die Person entscheidet selbst, was für sie zutrifft.
 */
export type CheckupAudience = 'all' | 'women' | 'men';

export type CheckupId =
  | 'checkup'
  | 'skin'
  | 'dental'
  | 'bowel'
  | 'cervix'
  | 'breast'
  | 'prostate'
  | 'aorta'
  | 'uExams'
  | 'dentalChild'
  | 'j1';

export type Checkup = {
  id: CheckupId;
  audience: CheckupAudience;
  minAge: number;
  maxAge: number | null;
  /** Abstand für die nächste Erinnerung in Monaten; null = einmalig */
  intervalMonths: number | null;
};

export const CHECKUPS: readonly Checkup[] = [
  // Erwachsene
  { id: 'checkup', audience: 'all', minAge: 18, maxAge: null, intervalMonths: 36 },
  { id: 'skin', audience: 'all', minAge: 35, maxAge: null, intervalMonths: 24 },
  { id: 'dental', audience: 'all', minAge: 18, maxAge: null, intervalMonths: 6 },
  { id: 'bowel', audience: 'all', minAge: 50, maxAge: null, intervalMonths: 24 },
  { id: 'cervix', audience: 'women', minAge: 20, maxAge: null, intervalMonths: 12 },
  { id: 'breast', audience: 'women', minAge: 50, maxAge: 75, intervalMonths: 24 },
  { id: 'prostate', audience: 'men', minAge: 45, maxAge: null, intervalMonths: 12 },
  { id: 'aorta', audience: 'men', minAge: 65, maxAge: null, intervalMonths: null },
  // Kinder und Jugendliche
  { id: 'uExams', audience: 'all', minAge: 0, maxAge: 5, intervalMonths: 3 },
  { id: 'dentalChild', audience: 'all', minAge: 0, maxAge: 17, intervalMonths: 6 },
  { id: 'j1', audience: 'all', minAge: 12, maxAge: 14, intervalMonths: null },
];

const AGE_RANGE: Record<AgeGroup, [number, number]> = {
  child_0_5: [0, 5],
  child_6_12: [6, 12],
  teen_13_17: [13, 17],
  adult_18_39: [18, 39],
  adult_40_64: [40, 64],
  senior_65_plus: [65, 120],
};

/** Angebote, die sich mit der Altersgruppe überschneiden. Ohne Altersgruppe: alle für Erwachsene. */
export function checkupsFor(ageGroup: AgeGroup | null): Checkup[] {
  const [lo, hi] = ageGroup ? AGE_RANGE[ageGroup] : [18, 120];
  return CHECKUPS.filter((c) => c.minAge <= hi && (c.maxAge === null || c.maxAge >= lo));
}

/** Nächste Fälligkeit: Datum + Monate, 10:00 Uhr Ortszeit (keine Erinnerung mitten in der Nacht). */
export function addMonthsAt10(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // 31. Januar + 1 Monat → Monatsende statt 3. März
  if (d.getDate() < day) d.setDate(0);
  d.setHours(10, 0, 0, 0);
  return d;
}

export const reminderKey = (profileId: string, checkupId: string) => `${profileId}:${checkupId}`;
