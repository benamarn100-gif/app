import { adaptSpecialtyIds, isMinor, profilesFrom, SELF, specialtiesFor } from '../profiles';
import { specialtyBySlug } from '../seed/catalog';

const GENERAL = specialtyBySlug('allgemeinmedizin')!.id;
const PEDIATRIC = specialtyBySlug('kinder-jugendmedizin')!.id;
const HNO = specialtyBySlug('hno')!.id;

describe('Familienprofile', () => {
  it('„Ich“ steht immer zuerst, dann Familienmitglieder', () => {
    const profiles = profilesFrom('Für mich', 'adult_18_39', [
      { id: 'd1', label: 'Mia', ageGroup: 'child_6_12' },
    ]);
    expect(profiles.map((p) => p.id)).toEqual([SELF, 'd1']);
  });

  it('Minderjährig: 0–17 Jahre', () => {
    expect(isMinor('teen_13_17')).toBe(true);
    expect(isMinor('adult_18_39')).toBe(false);
    expect(isMinor(null)).toBe(false);
  });

  it('Kind: Kinder- und Jugendmedizin zuerst, Erwachsene: zuletzt', () => {
    expect(specialtiesFor('child_0_5')[0]!.id).toBe(PEDIATRIC);
    const adult = specialtiesFor('adult_40_64');
    expect(adult[adult.length - 1]!.id).toBe(PEDIATRIC);
  });

  it('Profilwechsel tauscht Hausarzt ↔ Kinder- und Jugendarzt, andere bleiben', () => {
    expect(adaptSpecialtyIds([GENERAL, HNO], 'child_6_12')).toEqual([PEDIATRIC, HNO]);
    expect(adaptSpecialtyIds([PEDIATRIC], 'adult_18_39')).toEqual([GENERAL]);
    // Alter unbekannt: nichts ändern
    expect(adaptSpecialtyIds([PEDIATRIC], null)).toEqual([PEDIATRIC]);
  });
});
