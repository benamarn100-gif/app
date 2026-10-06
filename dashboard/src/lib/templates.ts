import type { NewTemplateInput, SlotTemplate } from '../data/types';
import { addBerlinDays, berlinDateTime, dateFromIso, isoWeekday, minutesOfDay } from './time';

export const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60] as const;
export const MAX_TEMPLATE_WEEKS = 8;

type Rule = Pick<SlotTemplate, 'startTime' | 'endTime' | 'slotMinutes'>;

/** Startzeiten einer Vorlage, z. B. 09:00–10:00 à 20 Min. → 09:00, 09:20, 09:40. */
export function ruleTimes(rule: Rule): string[] {
  const end = minutesOfDay(rule.endTime);
  const times: string[] = [];
  for (let t = minutesOfDay(rule.startTime); t + rule.slotMinutes <= end; t += rule.slotMinutes) {
    times.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return times;
}

export function isValidRule(rule: Rule): boolean {
  return (
    rule.slotMinutes >= 5 &&
    rule.slotMinutes <= 120 &&
    minutesOfDay(rule.endTime) - minutesOfDay(rule.startTime) >= rule.slotMinutes
  );
}

export function rulesOverlap(
  a: Pick<SlotTemplate, 'doctorId' | 'weekday' | 'startTime' | 'endTime'>,
  b: Pick<SlotTemplate, 'doctorId' | 'weekday' | 'startTime' | 'endTime'>,
): boolean {
  return (
    a.doctorId === b.doctorId &&
    a.weekday === b.weekday &&
    minutesOfDay(a.startTime) < minutesOfDay(b.endTime) &&
    minutesOfDay(b.startTime) < minutesOfDay(a.endTime)
  );
}

export type PlannedSlot = {
  doctorId: string;
  startsAt: Date;
  endsAt: Date;
  visitType: SlotTemplate['visitType'];
};

/**
 * Entspricht public.dashboard_apply_templates: alle zukünftigen Slots, die die
 * Vorlagen ab `fromIso` für `weeks` Wochen ergeben (Uhrzeiten in Berliner Ortszeit).
 */
export function expandTemplates(
  templates: readonly (SlotTemplate | NewTemplateInput)[],
  fromIso: string,
  weeks: number,
  now: Date,
): PlannedSlot[] {
  const first = dateFromIso(fromIso);
  const planned: PlannedSlot[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addBerlinDays(first, i);
    const weekday = isoWeekday(day);
    for (const template of templates) {
      if (template.weekday !== weekday) continue;
      for (const time of ruleTimes(template)) {
        const startsAt = berlinDateTime(day, time);
        if (startsAt.getTime() <= now.getTime()) continue;
        planned.push({
          doctorId: template.doctorId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + template.slotMinutes * 60_000),
          visitType: template.visitType,
        });
      }
    }
  }
  return planned.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}
