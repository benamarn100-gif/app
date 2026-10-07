import { can, higherPlan, PLAN_LIMITS, planFor, PRODUCTS } from '../plans';

describe('Abo-Stufen', () => {
  it('kostenlos: 1 Alarm, Ich + 1 Person, keine Komfortfunktionen', () => {
    expect(PLAN_LIMITS.free.activeAlarms).toBe(1);
    expect(PLAN_LIMITS.free.profiles).toBe(2);
    expect(can('free', 'calendarSync')).toBe(false);
    expect(can('free', 'favorites')).toBe(false);
    expect(PLAN_LIMITS.free.alarmDays).not.toContain(60);
  });

  it('Plus: 10 Alarme, lange Laufzeiten, Kalender-Sync, Favoriten, eigene Vorsorge', () => {
    expect(PLAN_LIMITS.plus.activeAlarms).toBe(10);
    expect(PLAN_LIMITS.plus.alarmDays).toContain(60);
    expect(can('plus', 'checkupReminders')).toBe(true);
    expect(can('plus', 'familyCheckupReminders')).toBe(false);
  });

  it('Familie: alles aus Plus, 5 Profile, Vorsorge für alle', () => {
    expect(PLAN_LIMITS.family.profiles).toBe(5);
    for (const f of ['calendarSync', 'favorites', 'checkupReminders', 'longAlarms'] as const) {
      expect(can('family', f)).toBe(true);
    }
    expect(planFor('familyCheckupReminders')).toBe('family');
    expect(planFor('favorites')).toBe('plus');
  });

  it('Testphase nur bei Jahresabos, der Pass verlängert sich nicht', () => {
    expect(PRODUCTS.filter((p) => p.trialDays > 0).every((p) => p.kind === 'yearly')).toBe(true);
    expect(PRODUCTS.find((p) => p.kind === 'pass')!.durationDays).toBe(30);
  });

  it('höhere Stufe gewinnt', () => {
    expect(higherPlan('free', 'plus')).toBe('plus');
    expect(higherPlan('family', 'plus')).toBe('family');
  });
});
