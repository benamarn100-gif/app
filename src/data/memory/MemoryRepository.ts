import type { CityConfig } from '@/config/city';
import { isSlotBookable, summarizeSlots } from '@/domain/availability/status';
import { distanceMeters } from '@/domain/geo/distance';
import { encodeGeohash } from '@/domain/geo/geohash';
import { compareRelevance } from '@/domain/ranking/acute';
import { SPECIALTIES } from '@/domain/seed/catalog';
import {
  generateDirectory,
  generateSlots,
  syncTimestamps,
  type DemoDirectory,
} from '@/domain/seed/generator';
import { uuidFromString } from '@/domain/seed/random';
import type {
  AgeGroup,
  Appointment,
  AppointmentWithDetails,
  BookingContact,
  Consent,
  ConsentType,
  Dependent,
  Doctor,
  LatLng,
  Practice,
  PracticeAvailability,
  PracticeDetail,
  Slot,
  WaitlistEntry,
  WaitlistOffer,
} from '@/domain/types';

import {
  AppError,
  HEALTH_CONSENT_VERSION,
  HOLD_MINUTES,
  OFFER_MINUTES,
  type BookInput,
  type HoldResult,
  type MedNowRepository,
  type SearchParams,
  type SessionInfo,
  type SlotChange,
  type WaitlistEntryWithLabel,
  type WaitlistInput,
} from '../repository';

type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type PersistedState = {
  session: SessionInfo;
  appointments: Appointment[];
  dependents: Dependent[];
  consents: Consent[];
  contact: BookingContact | null;
  waitlist: WaitlistEntry[];
};

export type MemoryRepositoryOptions = {
  city: CityConfig;
  now?: () => Date;
  /** Künstliche Latenz für realistische Lade-Zustände (0 in Tests). */
  latencyMs?: number;
  storage?: KeyValueStorage | null;
  /** Demo: Nach dem Eintragen in die Warteliste wird nach X ms ein Termin frei (null = aus). */
  simulateWaitlistReleaseMs?: number | null;
};

const STORAGE_KEY = 'mednow.memory.user.v1';

/**
 * Vollständige In-Memory-Implementierung mit denselben Regeln wie der Server
 * (bedingtes Halten/Buchen, Idempotenz, Warteliste FIFO mit 10-Minuten-Reservierung).
 * Für „Demo ohne Backend“, Komponenten-Showcase und Tests.
 */
export class MemoryRepository implements MedNowRepository {
  readonly mode = 'memory' as const;
  private readonly now: () => Date;
  private readonly latencyMs: number;
  private readonly storage: KeyValueStorage | null;
  private readonly simulateReleaseMs: number | null;
  private readonly city: CityConfig;
  private data: {
    directory: DemoDirectory;
    practices: Map<string, Practice>;
    doctors: Map<string, Doctor>;
    slots: Map<string, Slot & { heldBy?: string | null }>;
    synced: Map<string, string>;
  } | null = null;
  private state: PersistedState;
  private readonly idempotency = new Map<string, Appointment>();
  private offers: (Omit<WaitlistOffer, 'slot' | 'practice' | 'doctor'> & { slotId: string })[] = [];
  private readonly slotListeners = new Set<{ cells: Set<string>; cb: (c: SlotChange) => void }>();
  private readonly offerListeners = new Set<(o: WaitlistOffer) => void>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private loaded: Promise<void>;

  constructor(options: MemoryRepositoryOptions) {
    this.now = options.now ?? (() => new Date());
    this.latencyMs = options.latencyMs ?? 0;
    this.storage = options.storage ?? null;
    this.simulateReleaseMs = options.simulateWaitlistReleaseMs ?? null;
    this.city = options.city;
    const now = this.now();
    this.state = {
      session: {
        userId: uuidFromString(`local:${now.getTime()}:${Math.random()}`),
        isAnonymous: true,
        email: null,
      },
      appointments: [],
      dependents: [],
      consents: [],
      contact: null,
      waitlist: [],
    };
    // Demo-Daten erst nach dem ersten Frame erzeugen – der App-Start bleibt flüssig.
    this.loaded = new Promise<void>((resolve) => setTimeout(resolve, 0)).then(() => this.load());
  }

  /** Erzeugt die Demo-Daten beim ersten Zugriff (deterministisch, ~70 ms auf Desktop). */
  private get d() {
    if (!this.data) {
      const now = this.now();
      const directory = generateDirectory(this.city);
      this.data = {
        directory,
        practices: new Map(directory.practices.map((p) => [p.id, p])),
        doctors: new Map(directory.doctors.map((x) => [x.id, x])),
        slots: new Map(
          generateSlots(directory, now, 14).map((x) => [x.id, { ...x, heldBy: null }]),
        ),
        synced: syncTimestamps(directory, now),
      };
    }
    return this.data;
  }

  get directory(): DemoDirectory {
    return this.d.directory;
  }

  private get practices() {
    return this.d.practices;
  }

  private get doctors() {
    return this.d.doctors;
  }

  private get slots() {
    return this.d.slots;
  }

  private get synced() {
    return this.d.synced;
  }

  /** Räumt Timer auf (Tests). */
  dispose() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  // ---------------------------------------------------------------------------
  private async load() {
    if (!this.storage) return;
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as PersistedState;
      this.state = { ...this.state, ...saved };
      // Gebuchte Slots nach Neustart wieder als gebucht markieren (IDs sind deterministisch).
      for (const a of this.state.appointments) {
        const slot = this.slots.get(a.slotId);
        if (slot && a.status === 'confirmed') slot.status = 'booked';
      }
    } catch {
      // Beschädigter Speicher: mit leerem Zustand weiterarbeiten.
    }
  }

  private async persist() {
    if (!this.storage) return;
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  private async delay() {
    await this.loaded;
    if (this.latencyMs > 0)
      await new Promise((r) => setTimeout(r, this.latencyMs * (0.7 + Math.random() * 0.6)));
  }

  private emitSlot(slot: Slot) {
    const practice = this.practices.get(slot.practiceId);
    if (!practice) return;
    const cell = encodeGeohash(practice.location, 5);
    for (const l of this.slotListeners) if (l.cells.has(cell)) l.cb({ slot: { ...slot } });
  }

  private publicSlot(slot: Slot & { heldBy?: string | null }): Slot {
    const { heldBy: _heldBy, ...rest } = slot;
    return { ...rest };
  }

  private updateSlot(id: string, patch: Partial<Slot & { heldBy: string | null }>) {
    const slot = this.slots.get(id);
    if (!slot) return;
    Object.assign(slot, patch, { updatedAt: this.now().toISOString() });
    this.emitSlot(this.publicSlot(slot));
  }

  // --- Öffentliche Daten -------------------------------------------------
  async search(params: SearchParams, now: Date): Promise<PracticeAvailability[]> {
    await this.delay();
    const text = params.text.trim().toLowerCase();
    const byPractice = new Map<string, Slot[]>();
    for (const slot of this.slots.values()) {
      const list = byPractice.get(slot.practiceId);
      if (list) list.push(slot);
      else byPractice.set(slot.practiceId, [slot]);
    }
    const results: PracticeAvailability[] = [];
    for (const practice of this.practices.values()) {
      const distanceM = distanceMeters(params.center, practice.location);
      if (distanceM > params.radiusKm * 1000) continue;
      if (
        params.specialtyIds.length &&
        !practice.specialtyIds.some((id) => params.specialtyIds.includes(id))
      )
        continue;
      if (params.languages.length && !params.languages.every((l) => practice.languages.includes(l)))
        continue;
      if (
        params.accessibility.length &&
        !params.accessibility.every((f) => practice.accessibility[f])
      )
        continue;
      if (params.insurance === 'public' && !practice.acceptsPublic) continue;
      if (params.insurance === 'private' && !practice.acceptsPrivate) continue;
      if (params.videoOnly && !practice.offersVideo) continue;
      if (text && !this.matchesText(practice, text)) continue;
      const lastSyncedAt = this.synced.get(practice.id) ?? null;
      const relevant = (byPractice.get(practice.id) ?? []).filter(
        (s) => !params.videoOnly || s.visitType === 'video',
      );
      const summary = summarizeSlots(relevant, params.window, lastSyncedAt, now);
      results.push({ practice, ...summary, distanceM, lastSyncedAt });
    }
    return results.sort(compareRelevance);
  }

  private matchesText(practice: Practice, text: string): boolean {
    if (practice.name.toLowerCase().includes(text)) return true;
    const specialtyHit = SPECIALTIES.some(
      (s) =>
        practice.specialtyIds.includes(s.id) &&
        (s.nameDe.toLowerCase().includes(text) ||
          s.nameEn.toLowerCase().includes(text) ||
          s.slug.includes(text)),
    );
    if (specialtyHit) return true;
    return this.directory.doctors.some(
      (d) => d.practiceId === practice.id && d.name.toLowerCase().includes(text),
    );
  }

  async getPractice(id: string): Promise<PracticeDetail | null> {
    await this.delay();
    const practice = this.practices.get(id);
    if (!practice) return null;
    return {
      practice,
      doctors: this.directory.doctors.filter((d) => d.practiceId === id),
      lastSyncedAt: this.synced.get(id) ?? null,
    };
  }

  async getSlots(practiceId: string, from: Date, to: Date): Promise<Slot[]> {
    await this.delay();
    const fromMs = from.getTime();
    const toMs = to.getTime();
    return [...this.slots.values()]
      .filter((s) => s.practiceId === practiceId)
      .filter((s) => {
        const t = Date.parse(s.startsAt);
        return t >= fromMs && t <= toMs;
      })
      .map((s) => this.publicSlot(s))
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }

  subscribeToCells(cells: string[], onChange: (change: SlotChange) => void): () => void {
    const entry = { cells: new Set(cells), cb: onChange };
    this.slotListeners.add(entry);
    return () => this.slotListeners.delete(entry);
  }

  // --- Sitzung -------------------------------------------------------------
  async ensureSession(): Promise<SessionInfo> {
    await this.loaded;
    return this.state.session;
  }

  async requestEmailCode(email: string): Promise<void> {
    await this.delay();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('invalid_input');
  }

  async verifyEmailCode(email: string, code: string): Promise<SessionInfo> {
    await this.delay();
    if (!/^\d{6}$/.test(code)) throw new AppError('invalid_input');
    this.state.session = { ...this.state.session, isAnonymous: false, email };
    await this.persist();
    return this.state.session;
  }

  // --- Buchen ------------------------------------------------------------
  private me(): string {
    return this.state.session.userId;
  }

  async holdSlot(slotId: string): Promise<HoldResult> {
    await this.delay();
    const now = this.now();
    const slot = this.slots.get(slotId);
    if (!slot) throw new AppError('not_found');
    const heldByMe =
      slot.status === 'held' && slot.heldBy === this.me() && slot.holdReason === 'checkout';
    if (!heldByMe && !isSlotBookable(slot, now)) throw new AppError('slot_taken');
    // Pro Person nur ein aktiver Checkout-Hold
    for (const other of this.slots.values()) {
      if (
        other.id !== slotId &&
        other.status === 'held' &&
        other.heldBy === this.me() &&
        other.holdReason === 'checkout'
      ) {
        this.updateSlot(other.id, {
          status: 'open',
          heldUntil: null,
          holdReason: null,
          heldBy: null,
        });
      }
    }
    const heldUntil = new Date(now.getTime() + HOLD_MINUTES * 60000).toISOString();
    this.updateSlot(slotId, {
      status: 'held',
      heldUntil,
      holdReason: 'checkout',
      heldBy: this.me(),
    });
    return { slot: this.publicSlot(slot), heldUntil };
  }

  async releaseHold(slotId: string): Promise<void> {
    await this.delay();
    const slot = this.slots.get(slotId);
    if (
      slot &&
      slot.status === 'held' &&
      slot.heldBy === this.me() &&
      slot.holdReason === 'checkout'
    ) {
      this.updateSlot(slotId, { status: 'open', heldUntil: null, holdReason: null, heldBy: null });
    }
  }

  private hasHealthConsent(version: string): boolean {
    return this.state.consents.some(
      (c) => c.type === 'health_data' && c.version === version && !c.revokedAt,
    );
  }

  async bookSlot(input: BookInput): Promise<Appointment> {
    await this.delay();
    const key = `${this.me()}:${input.idempotencyKey}`;
    const previous = this.idempotency.get(key);
    if (previous) return previous;
    if (!this.hasHealthConsent(input.consentVersion)) throw new AppError('consent_missing');
    const appointment = this.bookInternal(input);
    this.idempotency.set(key, appointment);
    this.state.contact = input.contact;
    await this.persist();
    return appointment;
  }

  private bookInternal(
    input: Pick<BookInput, 'slotId' | 'dependentId' | 'reasonCategory'>,
    viaOfferId?: string,
  ): Appointment {
    const now = this.now();
    const slot = this.slots.get(input.slotId);
    if (!slot) throw new AppError('not_found');
    const heldByMe =
      slot.status === 'held' &&
      slot.heldBy === this.me() &&
      slot.heldUntil != null &&
      Date.parse(slot.heldUntil) > now.getTime() &&
      (slot.holdReason === 'checkout' || viaOfferId != null);
    if (!heldByMe && !isSlotBookable(slot, now)) {
      throw new AppError(slot.heldBy === this.me() ? 'hold_expired' : 'slot_taken');
    }
    if (this.state.appointments.some((a) => a.slotId === slot.id && a.status === 'confirmed')) {
      throw new AppError('slot_taken');
    }
    this.updateSlot(slot.id, { status: 'booked', heldUntil: null, holdReason: null, heldBy: null });
    const appointment: Appointment = {
      id: uuidFromString(`appt:${slot.id}:${now.getTime()}:${Math.random()}`),
      slotId: slot.id,
      practiceId: slot.practiceId,
      doctorId: slot.doctorId,
      dependentId: input.dependentId,
      reasonCategory: input.reasonCategory,
      status: 'confirmed',
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      visitType: slot.visitType,
      createdAt: now.toISOString(),
      cancelledAt: null,
    };
    this.state.appointments.push(appointment);
    return appointment;
  }

  async cancelAppointment(appointmentId: string): Promise<void> {
    await this.delay();
    const appointment = this.state.appointments.find(
      (a) => a.id === appointmentId && a.status === 'confirmed',
    );
    if (!appointment) throw new AppError('not_found');
    appointment.status = 'cancelled';
    appointment.cancelledAt = this.now().toISOString();
    const slot = this.slots.get(appointment.slotId);
    if (slot && Date.parse(slot.startsAt) > this.now().getTime()) {
      this.updateSlot(slot.id, { status: 'open', heldUntil: null, holdReason: null, heldBy: null });
      this.offerToWaitlist(slot.id, this.me());
    }
    await this.persist();
  }

  async rescheduleAppointment(
    appointmentId: string,
    newSlotId: string,
    idempotencyKey: string,
  ): Promise<Appointment> {
    await this.delay();
    const key = `${this.me()}:${idempotencyKey}`;
    const previous = this.idempotency.get(key);
    if (previous) return previous;
    const old = this.state.appointments.find(
      (a) => a.id === appointmentId && a.status === 'confirmed',
    );
    if (!old) throw new AppError('not_found');
    const next = this.bookInternal({
      slotId: newSlotId,
      dependentId: old.dependentId,
      reasonCategory: old.reasonCategory,
    });
    old.status = 'cancelled';
    old.cancelledAt = this.now().toISOString();
    const oldSlot = this.slots.get(old.slotId);
    if (oldSlot) {
      this.updateSlot(oldSlot.id, {
        status: 'open',
        heldUntil: null,
        holdReason: null,
        heldBy: null,
      });
      this.offerToWaitlist(oldSlot.id, this.me());
    }
    this.idempotency.set(key, next);
    await this.persist();
    return next;
  }

  async listAppointments(): Promise<AppointmentWithDetails[]> {
    await this.delay();
    const now = this.now().getTime();
    return this.state.appointments
      .map((a) => {
        const practice = this.practices.get(a.practiceId);
        const doctor = this.doctors.get(a.doctorId);
        if (!practice || !doctor) return null;
        const status =
          a.status === 'confirmed' && Date.parse(a.endsAt) < now ? 'completed' : a.status;
        const dependent = a.dependentId
          ? this.state.dependents.find((d) => d.id === a.dependentId)
          : null;
        return { ...a, status, practice, doctor, patientLabel: dependent?.label ?? null };
      })
      .filter((a): a is AppointmentWithDetails => a !== null)
      .sort((x, y) => Date.parse(x.startsAt) - Date.parse(y.startsAt));
  }

  async getContact(): Promise<BookingContact | null> {
    await this.loaded;
    return this.state.contact;
  }

  // --- Familie ------------------------------------------------------------
  async listDependents(): Promise<Dependent[]> {
    await this.delay();
    return [...this.state.dependents];
  }

  async addDependent(label: string, ageGroup: AgeGroup): Promise<Dependent> {
    await this.delay();
    const trimmed = label.trim();
    if (!trimmed || trimmed.length > 40) throw new AppError('invalid_input');
    const dependent = {
      id: uuidFromString(`dep:${trimmed}:${Date.now()}:${Math.random()}`),
      label: trimmed,
      ageGroup,
    };
    this.state.dependents.push(dependent);
    await this.persist();
    return dependent;
  }

  async removeDependent(id: string): Promise<void> {
    await this.delay();
    this.state.dependents = this.state.dependents.filter((d) => d.id !== id);
    await this.persist();
  }

  // --- Warteliste --------------------------------------------------------
  async joinWaitlist(input: WaitlistInput, center: LatLng): Promise<WaitlistEntry> {
    await this.delay();
    const now = this.now();
    if (!this.hasHealthConsent(HEALTH_CONSENT_VERSION)) throw new AppError('consent_missing');
    const target = input.target.kind === 'specialty' ? { ...input.target, center } : input.target;
    const entry: WaitlistEntry = {
      id: uuidFromString(`wl:${now.getTime()}:${Math.random()}`),
      target,
      windowStart: now.toISOString(),
      windowEnd: new Date(now.getTime() + input.days * 24 * 3600 * 1000).toISOString(),
      maxDistanceKm: input.maxDistanceKm,
      status: 'active',
      createdAt: now.toISOString(),
    };
    this.state.waitlist.push(entry);
    await this.persist();
    if (this.simulateReleaseMs != null) this.scheduleSimulatedRelease(entry);
    return entry;
  }

  async leaveWaitlist(entryId: string): Promise<void> {
    await this.delay();
    const entry = this.state.waitlist.find((e) => e.id === entryId);
    if (entry) entry.status = 'cancelled';
    for (const offer of this.offers.filter(
      (o) => o.entryId === entryId && o.status === 'pending',
    )) {
      this.expireOffer(offer.id, 'declined');
    }
    await this.persist();
  }

  async listWaitlist(): Promise<WaitlistEntryWithLabel[]> {
    await this.delay();
    return this.state.waitlist
      .filter((e) => e.status === 'active')
      .map((e) => {
        const practice =
          e.target.kind === 'practice'
            ? this.practices.get(e.target.practiceId)
            : e.target.kind === 'doctor'
              ? this.practices.get(this.doctors.get(e.target.doctorId)?.practiceId ?? '')
              : undefined;
        const specialty =
          e.target.kind === 'specialty'
            ? SPECIALTIES.find((s) => s.id === (e.target as { specialtyId: number }).specialtyId)
            : undefined;
        return {
          ...e,
          label: practice?.name ?? specialty?.slug ?? '',
          practiceName: practice?.name ?? null,
        };
      });
  }

  private entryMatches(entry: WaitlistEntry, slot: Slot): boolean {
    if (entry.status !== 'active') return false;
    const start = Date.parse(slot.startsAt);
    if (start < Date.parse(entry.windowStart) || start > Date.parse(entry.windowEnd)) return false;
    const target = entry.target;
    if (target.kind === 'practice') return target.practiceId === slot.practiceId;
    if (target.kind === 'doctor') return target.doctorId === slot.doctorId;
    const practice = this.practices.get(slot.practiceId);
    const doctor = this.doctors.get(slot.doctorId);
    if (!practice || !doctor) return false;
    return (
      doctor.specialtyIds.includes(target.specialtyId) &&
      distanceMeters(target.center, practice.location) <= entry.maxDistanceKm * 1000
    );
  }

  /**
   * FIFO nach Eintragszeit: der erste passende Eintrag erhält ein Angebot mit
   * 10 Minuten Reservierung. Läuft es ab, rückt der nächste nach.
   */
  private offerToWaitlist(slotId: string, excludeUserSlotOwner?: string) {
    const slot = this.slots.get(slotId);
    if (!slot || slot.status !== 'open') return;
    const alreadyOffered = new Set(
      this.offers.filter((o) => o.slotId === slotId).map((o) => o.entryId),
    );
    const pendingEntries = new Set(
      this.offers.filter((o) => o.status === 'pending').map((o) => o.entryId),
    );
    const candidate = [...this.state.waitlist]
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .find(
        (e) => !alreadyOffered.has(e.id) && !pendingEntries.has(e.id) && this.entryMatches(e, slot),
      );
    // Wer den Termin gerade selbst storniert hat, bekommt ihn nicht direkt wieder angeboten.
    if (!candidate || excludeUserSlotOwner === this.me()) return;
    const now = this.now();
    const expiresAt = new Date(now.getTime() + OFFER_MINUTES * 60000).toISOString();
    const offer = {
      id: uuidFromString(`offer:${slotId}:${candidate.id}:${now.getTime()}`),
      entryId: candidate.id,
      slotId,
      offeredAt: now.toISOString(),
      expiresAt,
      status: 'pending' as const,
    };
    this.offers.push(offer);
    this.updateSlot(slotId, {
      status: 'held',
      heldUntil: expiresAt,
      holdReason: 'waitlist_offer',
      heldBy: this.me(),
    });
    const full = this.toOffer(offer);
    if (full) for (const l of this.offerListeners) l(full);
    const timer = setTimeout(() => this.expireOffer(offer.id, 'expired'), OFFER_MINUTES * 60000);
    this.timers.add(timer);
  }

  /** Läuft ein Angebot ab (oder wird abgelehnt), rückt die nächste Person nach. */
  expireOffer(offerId: string, status: 'expired' | 'declined') {
    const offer = this.offers.find((o) => o.id === offerId);
    if (!offer || offer.status !== 'pending') return;
    offer.status = status;
    const slot = this.slots.get(offer.slotId);
    if (slot && slot.status === 'held' && slot.holdReason === 'waitlist_offer') {
      this.updateSlot(slot.id, { status: 'open', heldUntil: null, holdReason: null, heldBy: null });
      this.offerToWaitlist(slot.id);
    }
  }

  private toOffer(o: (typeof this.offers)[number]): WaitlistOffer | null {
    const slot = this.slots.get(o.slotId);
    const practice = slot && this.practices.get(slot.practiceId);
    const doctor = slot && this.doctors.get(slot.doctorId);
    if (!slot || !practice || !doctor) return null;
    return { ...o, slot: this.publicSlot(slot), practice, doctor };
  }

  async listOffers(): Promise<WaitlistOffer[]> {
    await this.delay();
    const now = this.now().getTime();
    for (const o of this.offers)
      if (o.status === 'pending' && Date.parse(o.expiresAt) <= now)
        this.expireOffer(o.id, 'expired');
    return this.offers.map((o) => this.toOffer(o)).filter((o): o is WaitlistOffer => o !== null);
  }

  async respondOffer(
    offerId: string,
    accept: boolean,
    booking?: Omit<BookInput, 'slotId'>,
  ): Promise<Appointment | null> {
    await this.delay();
    const offer = this.offers.find((o) => o.id === offerId);
    if (!offer) throw new AppError('not_found');
    if (offer.status !== 'pending' || Date.parse(offer.expiresAt) <= this.now().getTime()) {
      if (offer.status === 'pending') this.expireOffer(offer.id, 'expired');
      throw new AppError('offer_expired');
    }
    if (!accept) {
      this.expireOffer(offer.id, 'declined');
      return null;
    }
    if (!booking) throw new AppError('invalid_input');
    if (!this.hasHealthConsent(booking.consentVersion)) throw new AppError('consent_missing');
    const appointment = this.bookInternal({ ...booking, slotId: offer.slotId }, offer.id);
    offer.status = 'accepted';
    const entry = this.state.waitlist.find((e) => e.id === offer.entryId);
    if (entry) entry.status = 'fulfilled';
    this.state.contact = booking.contact;
    await this.persist();
    return appointment;
  }

  subscribeToOffers(onOffer: (offer: WaitlistOffer) => void): () => void {
    this.offerListeners.add(onOffer);
    return () => this.offerListeners.delete(onOffer);
  }

  async registerPushToken(): Promise<void> {
    await this.delay();
  }

  /**
   * Demo-Simulation: Eine (fiktive) andere Person storniert einen passenden Termin,
   * damit sich der Warteliste-Ablauf ohne Backend ausprobieren lässt.
   */
  private scheduleSimulatedRelease(entry: WaitlistEntry) {
    const timer = setTimeout(() => {
      if (entry.status !== 'active') return;
      const now = this.now().getTime();
      const candidate = [...this.slots.values()]
        .filter((s) => s.status === 'booked' && Date.parse(s.startsAt) > now + 3600_000)
        .filter(
          (s) =>
            !this.state.appointments.some((a) => a.slotId === s.id && a.status === 'confirmed'),
        )
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
        .find((s) => this.entryMatches(entry, { ...s, status: 'open' }));
      if (!candidate) return;
      this.updateSlot(candidate.id, { status: 'open' });
      this.offerToWaitlist(candidate.id);
    }, this.simulateReleaseMs ?? 0);
    this.timers.add(timer);
  }

  // --- Datenschutz -------------------------------------------------------
  async listConsents(): Promise<Consent[]> {
    await this.delay();
    return [...this.state.consents];
  }

  async grantConsent(type: ConsentType, version: string): Promise<void> {
    await this.delay();
    this.state.consents.push({
      type,
      version,
      grantedAt: this.now().toISOString(),
      revokedAt: null,
    });
    await this.persist();
  }

  async revokeConsent(type: ConsentType): Promise<void> {
    await this.delay();
    const at = this.now().toISOString();
    for (const c of this.state.consents) if (c.type === type && !c.revokedAt) c.revokedAt = at;
    await this.persist();
  }

  async exportData(): Promise<Record<string, unknown>> {
    await this.delay();
    return {
      exportedAt: this.now().toISOString(),
      mode: 'demo',
      session: this.state.session,
      appointments: this.state.appointments,
      dependents: this.state.dependents,
      consents: this.state.consents,
      contact: this.state.contact,
      waitlist: this.state.waitlist,
    };
  }

  async deleteAccount(): Promise<void> {
    await this.delay();
    for (const a of this.state.appointments.filter((x) => x.status === 'confirmed')) {
      const slot = this.slots.get(a.slotId);
      if (slot)
        this.updateSlot(slot.id, {
          status: 'open',
          heldUntil: null,
          holdReason: null,
          heldBy: null,
        });
    }
    this.state = {
      session: {
        userId: uuidFromString(`local:${Date.now()}:${Math.random()}`),
        isAnonymous: true,
        email: null,
      },
      appointments: [],
      dependents: [],
      consents: [],
      contact: null,
      waitlist: [],
    };
    this.offers = [];
    if (this.storage) await this.storage.removeItem(STORAGE_KEY);
  }

  // --- Test-Hilfen ---------------------------------------------------------
  /** Nur Tests: Slot direkt lesen. */
  peekSlot(id: string): Slot | undefined {
    const s = this.slots.get(id);
    return s ? this.publicSlot(s) : undefined;
  }

  /** Nur Tests/Demo: Slot freigeben, als hätte eine andere Person storniert. */
  releaseSlotAsOtherUser(id: string) {
    this.updateSlot(id, { status: 'open', heldUntil: null, holdReason: null, heldBy: null });
    this.offerToWaitlist(id);
  }
}
