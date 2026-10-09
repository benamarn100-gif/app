import { addMonthsAt10, CHECKUPS, checkupsFor, intervalFor } from '../checkups';

const ids = (g: Parameters<typeof checkupsFor>[0]) => checkupsFor(g).map((c) => c.id);

describe('Vorsorge-Übersicht', () => {
  it('18–39: Check-up, Zahn, Hautkrebs ab 35, Gebärmutterhals ab 20 – keine Darm-/Brust-/Aorta-Angebote', () => {
    const list = ids('adult_18_39');
    expect(list).toEqual(expect.arrayContaining(['checkup', 'dental', 'skin', 'cervix']));
    expect(list).not.toEqual(expect.arrayContaining(['bowel']));
    expect(list).not.toContain('breast');
    expect(list).not.toContain('aorta');
    expect(list).not.toContain('uExams');
  });

  it('65+: Aorta-Ultraschall (einmalig), Mammographie bis 75', () => {
    const list = ids('senior_65_plus');
    expect(list).toEqual(expect.arrayContaining(['aorta', 'breast', 'bowel', 'prostate']));
    expect(CHECKUPS.find((c) => c.id === 'aorta')!.intervalMonths).toBeNull();
  });

  it('Kleinkind: U-Untersuchungen und Zahn, kein Check-up für Erwachsene', () => {
    const list = ids('child_0_5');
    expect(list).toEqual(['uExams', 'dentalChild']);
  });

  it('12–17: J1 und Zahn', () => {
    expect(ids('child_6_12')).toEqual(expect.arrayContaining(['j1', 'dentalChild']));
    expect(ids('teen_13_17')).toEqual(expect.arrayContaining(['j1', 'dentalChild']));
  });

  it('ohne Altersgruppe: Erwachsenen-Angebote', () => {
    expect(ids(null)).toContain('checkup');
    expect(ids(null)).not.toContain('uExams');
  });

  it('Gebärmutterhals: jährlich bis 34, ab 35 alle 3 Jahre – 18–39 im Zweifel jährlich', () => {
    const cervix = CHECKUPS.find((c) => c.id === 'cervix')!;
    expect(intervalFor(cervix, 'adult_18_39')).toBe(12);
    expect(intervalFor(cervix, 'adult_40_64')).toBe(36);
    expect(intervalFor(cervix, 'senior_65_plus')).toBe(36);
    expect(intervalFor(cervix, null)).toBe(12);
  });

  it('Lungenkrebs-Früherkennung 50–75, Chlamydien-Test nur für junge Erwachsene', () => {
    expect(ids('adult_40_64')).toContain('lung');
    expect(ids('senior_65_plus')).toContain('lung');
    expect(ids('adult_18_39')).not.toContain('lung');
    expect(ids('adult_18_39')).toContain('chlamydia');
    expect(ids('adult_40_64')).not.toContain('chlamydia');
    expect(ids('teen_13_17')).not.toContain('chlamydia');
  });

  it('Fälligkeit: Monate addieren, Monatsende abfangen, 10:00 Uhr', () => {
    const d = addMonthsAt10(new Date(2026, 0, 31, 22, 15), 1);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 1, 28, 10]);
    const y = addMonthsAt10(new Date(2026, 9, 7), 36);
    expect([y.getFullYear(), y.getMonth(), y.getDate()]).toEqual([2029, 9, 7]);
  });
});
