import { cities, type CityConfig } from '@app/config/city';
import { isSlotBookable } from '@app/domain/availability/status';
import { generateDirectory, generateSlots, syncTimestamps } from '@app/domain/seed/generator';
import { createRandom } from '@app/domain/seed/random';
import { REASON_CATEGORIES, type AgeGroup, type Doctor, type Practice } from '@app/domain/types';

import { readStorage, writeStorage } from '../lib/storage';
import {
  expandTemplates,
  isValidRule,
  MAX_TEMPLATE_WEEKS,
  rangesOverlap,
  rulesOverlap,
} from '../lib/templates';
import { berlinIsoDate, dateFromIso, startOfBerlinDay } from '../lib/time';
import {
  DashboardError,
  type AuthState,
  type Booking,
  type DashboardAuth,
  type DashboardRepository,
  type DashboardSlot,
  type LiveEvent,
  type Membership,
  type NewSlotInput,
  type NewTemplateInput,
  type SlotTemplate,
  type WeekData,
} from './types';

/**
 * Demo-Datenquelle: eine fiktive Praxis aus dem Seed-Generator der App (gleiche Praxen,
 * gleiche Slots wie die Demo-App). Buchungen tragen erkennbar fiktive Namen
 * („Mustermann“, „Beispiel“) und Telefonnummern aus dem Film-/TV-Bereich 069 90009.
 * Regeln (Überschneidung, Vergangenheit, gebuchte Slots) entsprechen den SQL-Funktionen.
 */

const DEMO_CONTACTS = [
  'Erika Mustermann',
  'Max Mustermann',
  'Mara Beispiel',
  'Jonas Beispiel',
  'Lea Muster',
  'Tim Muster',
  'Ida Exempel',
  'Noah Exempel',
] as const;
const DEPENDENT_AGES: AgeGroup[] = ['child_0_5', 'child_6_12', 'teen_13_17'];
const STATE_KEY = 'mednow.dashboard.demo';
const SESSION_KEY = 'mednow.dashboard.demoSession';
const STATE_VERSION = 1;
const MAX_STATE_AGE_MS = 6 * 60 * 60 * 1000;

type DemoState = {
  version: number;
  createdAt: string;
  practice: Practice;
  doctors: Doctor[];
  slots: DashboardSlot[];
  bookings: Booking[];
  templates: SlotTemplate[];
  lastSyncedAt: string | null;
  liveSimulated: boolean;
};

export type DemoOptions = {
  city?: CityConfig;
  now?: () => Date;
  /** Simuliert nach `liveDelayMs` eine neue Buchung über die App (Realtime-Vorführung). */
  simulateLive?: boolean;
  liveDelayMs?: number;
  /** Zustand im sessionStorage halten (übersteht Neuladen im selben Tab). */
  persist?: boolean;
};

const clone = <T>(value: T): T => structuredClone(value);

function demoPhone(index: number): string {
  return `+49 69 90009 9${String(index % 100).padStart(2, '0')}`;
}

function fictionalBooking(slot: DashboardSlot, now: Date, index: number): Booking {
  const rnd = createRandom(`demo-booking:${slot.id}`);
  const forDependent = rnd.chance(0.15);
  const createdMs = Math.min(
    now.getTime() - 5 * 60_000,
    new Date(slot.startsAt).getTime() - rnd.int(1, 72) * 3_600_000,
  );
  return {
    id: `demo-appt-${slot.id}`,
    slotId: slot.id,
    doctorId: slot.doctorId,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    visitType: slot.visitType,
    status: 'confirmed',
    reasonCategory: rnd.chance(0.85) ? rnd.pick(REASON_CATEGORIES) : null,
    forDependent,
    dependentAgeGroup: forDependent ? rnd.pick(DEPENDENT_AGES) : null,
    contact: {
      fullName: rnd.pick(DEMO_CONTACTS),
      phone: demoPhone(index),
      insurance: rnd.chance(0.85) ? 'public' : 'private',
    },
    createdAt: new Date(createdMs).toISOString(),
    cancelledAt: null,
  };
}

/** Erzeugt den Demo-Zustand: die Praxis mit den meisten Ärztinnen/Ärzten. */
export function createDemoState(city: CityConfig, now: Date): DemoState {
  const directory = generateDirectory(city);
  const counts = new Map<string, number>();
  for (const d of directory.doctors) counts.set(d.practiceId, (counts.get(d.practiceId) ?? 0) + 1);
  const practice = [...directory.practices].sort(
    (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
  )[0];
  if (!practice) throw new Error('Demo-Verzeichnis ist leer');
  const doctors = directory.doctors.filter((d) => d.practiceId === practice.id);
  const slots: DashboardSlot[] = generateSlots(directory, now, 14)
    .filter((s) => s.practiceId === practice.id)
    .map((s) => ({ ...s, source: 'seed', appointmentId: null }));

  const bookings: Booking[] = [];
  const horizon = now.getTime() + 14 * 86_400_000;
  for (const slot of slots) {
    const start = new Date(slot.startsAt).getTime();
    if (slot.status !== 'booked' || start < now.getTime() - 86_400_000 || start > horizon) continue;
    if (!createRandom(`demo-via-app:${slot.id}`).chance(0.45)) continue;
    const booking = fictionalBooking(slot, now, bookings.length);
    slot.appointmentId = booking.id;
    bookings.push(booking);
  }

  return {
    version: STATE_VERSION,
    createdAt: now.toISOString(),
    practice,
    doctors,
    slots,
    bookings,
    templates: [],
    lastSyncedAt: syncTimestamps(directory, now).get(practice.id) ?? null,
    liveSimulated: false,
  };
}

class DemoAuth implements DashboardAuth {
  private listeners = new Set<() => void>();
  private signedIn: boolean;

  constructor(private readonly persist: boolean) {
    this.signedIn = persist && readStorage(SESSION_KEY, 'session') === '1';
  }

  current(): Promise<AuthState> {
    return Promise.resolve(this.signedIn ? { kind: 'ready', email: null } : { kind: 'signedOut' });
  }

  onChange(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private set(value: boolean) {
    this.signedIn = value;
    if (this.persist) writeStorage(SESSION_KEY, value ? '1' : null, 'session');
    for (const listener of this.listeners) listener();
  }

  signInDemo = () => {
    this.set(true);
    return Promise.resolve();
  };

  signOut() {
    this.set(false);
    return Promise.resolve();
  }

  // Im Demo-Modus gibt es keine E-Mail-Anmeldung und keinen zweiten Faktor.
  sendCode(): Promise<void> {
    return Promise.reject(new DashboardError('invalid_input'));
  }
  verifyCode(): Promise<void> {
    return Promise.reject(new DashboardError('invalid_input'));
  }
  startTotpEnrollment(): Promise<never> {
    return Promise.reject(new DashboardError('invalid_input'));
  }
  verifyTotp(): Promise<void> {
    return Promise.reject(new DashboardError('invalid_input'));
  }
}

export class DemoDashboardRepository implements DashboardRepository {
  readonly mode = 'demo' as const;
  readonly auth: DemoAuth;
  private cached: DemoState | null = null;
  private readonly now: () => Date;
  private readonly city: CityConfig;
  private readonly persist: boolean;

  constructor(private readonly options: DemoOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.city = options.city ?? cities.fulda;
    this.persist = options.persist ?? true;
    this.auth = new DemoAuth(this.persist);
  }

  /** Zustand wird erst beim ersten Zugriff erzeugt (Seed-Generierung ~50 ms). */
  private get state(): DemoState {
    if (this.cached) return this.cached;
    const now = this.now();
    if (this.persist) {
      try {
        const raw = readStorage(STATE_KEY, 'session');
        const stored = raw ? (JSON.parse(raw) as DemoState) : null;
        if (
          stored?.version === STATE_VERSION &&
          now.getTime() - new Date(stored.createdAt).getTime() < MAX_STATE_AGE_MS
        ) {
          this.cached = stored;
          return stored;
        }
      } catch {
        // Beschädigter Zustand → neu erzeugen
      }
    }
    this.cached = createDemoState(this.city, now);
    this.save();
    return this.cached;
  }

  private save() {
    if (this.persist && this.cached) {
      writeStorage(STATE_KEY, JSON.stringify(this.cached), 'session');
    }
  }

  private assertPractice(practiceId: string) {
    if (practiceId !== this.state.practice.id) throw new DashboardError('forbidden');
  }

  private touch(): string {
    const at = this.now().toISOString();
    this.state.lastSyncedAt = at;
    this.save();
    return at;
  }

  private overlaps(doctorId: string, start: number, end: number): boolean {
    return this.state.slots.some(
      (s) =>
        s.doctorId === doctorId &&
        s.status !== 'cancelled' &&
        rangesOverlap(start, end, new Date(s.startsAt).getTime(), new Date(s.endsAt).getTime()),
    );
  }

  private addSlot(
    doctorId: string,
    start: Date,
    minutes: number,
    visitType: DashboardSlot['visitType'],
  ) {
    const now = this.now().toISOString();
    const slot: DashboardSlot = {
      id: crypto.randomUUID(),
      doctorId,
      practiceId: this.state.practice.id,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
      status: 'open',
      heldUntil: null,
      holdReason: null,
      visitType,
      updatedAt: now,
      source: 'practice_dashboard',
      appointmentId: null,
    };
    this.state.slots.push(slot);
    return slot;
  }

  // --- Lesen ---------------------------------------------------------------------
  myPractices(): Promise<Membership[]> {
    return Promise.resolve([{ practice: clone(this.state.practice), role: 'owner' }]);
  }

  async week(practiceId: string, from: Date, to: Date): Promise<WeekData> {
    this.assertPractice(practiceId);
    const { practice, doctors, slots, lastSyncedAt } = this.state;
    return {
      role: 'owner',
      practice: clone(practice),
      doctors: clone(doctors),
      slots: clone(
        slots
          .filter((s) => {
            const start = new Date(s.startsAt).getTime();
            return s.status !== 'cancelled' && start >= from.getTime() && start < to.getTime();
          })
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      ),
      lastSyncedAt,
      serverNow: this.now().toISOString(),
    };
  }

  async bookings(practiceId: string, from: Date, to: Date): Promise<Booking[]> {
    this.assertPractice(practiceId);
    return clone(
      this.state.bookings
        .filter((b) => {
          const start = new Date(b.startsAt).getTime();
          return start >= from.getTime() && start < to.getTime();
        })
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    );
  }

  async templates(practiceId: string): Promise<SlotTemplate[]> {
    this.assertPractice(practiceId);
    return clone(this.state.templates);
  }

  // --- Schreiben -----------------------------------------------------------------
  async createSlot(practiceId: string, input: NewSlotInput): Promise<DashboardSlot> {
    this.assertPractice(practiceId);
    const now = this.now().getTime();
    const start = input.startsAt.getTime();
    if (
      !Number.isFinite(start) ||
      input.minutes < 5 ||
      input.minutes > 120 ||
      start <= now ||
      start > now + 120 * 86_400_000 ||
      !this.state.doctors.some((d) => d.id === input.doctorId)
    ) {
      throw new DashboardError('invalid_input');
    }
    if (this.overlaps(input.doctorId, start, start + input.minutes * 60_000)) {
      throw new DashboardError('slot_overlap');
    }
    const slot = this.addSlot(input.doctorId, input.startsAt, input.minutes, input.visitType);
    this.touch();
    return clone(slot);
  }

  async cancelSlot(practiceId: string, slotId: string): Promise<void> {
    this.assertPractice(practiceId);
    const slot = this.state.slots.find((s) => s.id === slotId);
    if (!slot || slot.status === 'cancelled') throw new DashboardError('not_found');
    if (slot.status === 'booked') throw new DashboardError('slot_booked');
    const now = this.now();
    const expiredCheckout =
      slot.holdReason === 'checkout' && !!slot.heldUntil && new Date(slot.heldUntil) <= now;
    if (slot.status === 'held' && !expiredCheckout) throw new DashboardError('slot_held');
    Object.assign(slot, {
      status: 'cancelled',
      heldUntil: null,
      holdReason: null,
      updatedAt: now.toISOString(),
    });
    this.touch();
  }

  async cancelAppointment(practiceId: string, appointmentId: string): Promise<void> {
    this.assertPractice(practiceId);
    const now = this.now();
    const booking = this.state.bookings.find((b) => b.id === appointmentId);
    if (!booking || booking.status !== 'confirmed' || new Date(booking.startsAt) <= now) {
      throw new DashboardError('not_found');
    }
    Object.assign(booking, { status: 'cancelled', cancelledAt: now.toISOString(), contact: null });
    const slot = this.state.slots.find((s) => s.id === booking.slotId);
    if (slot)
      Object.assign(slot, {
        status: 'cancelled',
        appointmentId: null,
        updatedAt: now.toISOString(),
      });
    this.touch();
  }

  async addTemplate(practiceId: string, input: NewTemplateInput): Promise<SlotTemplate> {
    this.assertPractice(practiceId);
    if (
      input.weekday < 1 ||
      input.weekday > 7 ||
      !isValidRule(input) ||
      !this.state.doctors.some((d) => d.id === input.doctorId)
    ) {
      throw new DashboardError('invalid_input');
    }
    if (this.state.templates.some((t) => rulesOverlap(t, input))) {
      throw new DashboardError('template_overlap');
    }
    const template: SlotTemplate = { ...input, id: crypto.randomUUID() };
    this.state.templates.push(template);
    this.save();
    return clone(template);
  }

  async deleteTemplate(practiceId: string, templateId: string): Promise<void> {
    this.assertPractice(practiceId);
    const before = this.state.templates.length;
    this.state.templates = this.state.templates.filter((t) => t.id !== templateId);
    if (this.state.templates.length === before) throw new DashboardError('not_found');
    this.save();
  }

  async applyTemplates(practiceId: string, fromDate: string, weeks: number): Promise<number> {
    this.assertPractice(practiceId);
    const now = this.now();
    const today = startOfBerlinDay(now).getTime();
    const from = dateFromIso(fromDate).getTime();
    if (
      !Number.isInteger(weeks) ||
      weeks < 1 ||
      weeks > MAX_TEMPLATE_WEEKS ||
      from < today - 7 * 86_400_000 ||
      from > today + 120 * 86_400_000
    ) {
      throw new DashboardError('invalid_input');
    }
    let created = 0;
    for (const planned of expandTemplates(this.state.templates, fromDate, weeks, now)) {
      if (this.overlaps(planned.doctorId, planned.startsAt.getTime(), planned.endsAt.getTime()))
        continue;
      const minutes = (planned.endsAt.getTime() - planned.startsAt.getTime()) / 60_000;
      this.addSlot(planned.doctorId, planned.startsAt, minutes, planned.visitType);
      created++;
    }
    this.touch();
    return created;
  }

  async confirmAvailability(practiceId: string): Promise<string> {
    this.assertPractice(practiceId);
    return this.touch();
  }

  // --- Live ------------------------------------------------------------------------
  /**
   * Demo: Nach kurzer Zeit „bucht“ eine fiktive Person über die App den nächsten
   * freien Termin – so wird sichtbar, wie Buchungen live im Dashboard ankommen.
   */
  subscribe(practice: Practice, listener: (event: LiveEvent) => void): () => void {
    if (!(this.options.simulateLive ?? true) || this.state.liveSimulated) return () => undefined;
    const timer = setTimeout(() => {
      const now = this.now();
      const limit = now.getTime() + 2 * 86_400_000;
      const slot = this.state.slots
        .filter((s) => s.practiceId === practice.id && isSlotBookable(s, now))
        .filter((s) => new Date(s.startsAt).getTime() > now.getTime() + 3_600_000)
        .filter((s) => new Date(s.startsAt).getTime() < limit)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
      this.state.liveSimulated = true;
      if (!slot) {
        this.save();
        return;
      }
      const booking = {
        ...fictionalBooking(slot, now, this.state.bookings.length),
        createdAt: now.toISOString(),
      };
      Object.assign(slot, {
        status: 'booked',
        appointmentId: booking.id,
        updatedAt: now.toISOString(),
      });
      this.state.bookings.push(booking);
      this.save();
      listener({ slotId: slot.id, status: 'booked' });
    }, this.options.liveDelayMs ?? 25_000);
    return () => clearTimeout(timer);
  }

  /** Für Tests: Berliner Datum (YYYY-MM-DD) des heutigen Tages. */
  todayIso(): string {
    return berlinIsoDate(this.now());
  }
}
