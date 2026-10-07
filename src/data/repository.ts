import type {
  AccessibilityFeature,
  AgeGroup,
  Appointment,
  AppointmentWithDetails,
  BookingContact,
  Consent,
  ConsentType,
  Dependent,
  InsuranceType,
  LatLng,
  PracticeAvailability,
  PracticeDetail,
  ReasonCategory,
  Slot,
  TimeWindow,
  WaitlistEntry,
  WaitlistOffer,
  WaitlistTarget,
} from '@/domain/types';

/**
 * App-seitiger Datenzugriff (Ebene 2 des Adapter-Musters, siehe docs/architecture.md §2.1).
 * Implementierungen: MemoryRepository (Demo ohne Backend, Tests) und SupabaseRepository.
 * Woher die Slots stammen (Seed, Praxis-Dashboard, 116117), entscheidet der Server.
 */

export const HEALTH_CONSENT_VERSION = '2026-10-01';
export const HOLD_MINUTES = 5;
export const OFFER_MINUTES = 10;

export type InsuranceFilter = 'any' | InsuranceType;

export type SearchParams = {
  center: LatLng;
  radiusKm: number;
  window: TimeWindow;
  specialtyIds: number[];
  languages: string[];
  accessibility: AccessibilityFeature[];
  insurance: InsuranceFilter;
  videoOnly: boolean;
  text: string;
};

export type SlotChange = { slot: Slot };

export type SessionInfo = {
  userId: string;
  isAnonymous: boolean;
  email: string | null;
};

export type BookInput = {
  slotId: string;
  idempotencyKey: string;
  dependentId: string | null;
  reasonCategory: ReasonCategory | null;
  contact: BookingContact;
  consentVersion: string;
};

export type HoldResult = { slot: Slot; heldUntil: string };

export const ALARM_DAYS = [1, 3, 7, 14] as const;
export type AlarmDays = (typeof ALARM_DAYS)[number];

export type WaitlistInput = {
  target: WaitlistTarget;
  /** 1 = nächste 24 Stunden („Heute noch frei“) */
  days: AlarmDays;
  maxDistanceKm: number;
};

export type WaitlistEntryWithLabel = WaitlistEntry & { label: string; practiceName: string | null };

export type ErrorCode =
  | 'slot_taken'
  | 'hold_expired'
  | 'consent_missing'
  | 'verification_required'
  | 'offer_expired'
  | 'not_found'
  | 'network'
  | 'rate_limited'
  /** Grenze der Abo-Stufe erreicht (Termin-Alarme, Profile) */
  | 'plan_limit'
  | 'invalid_input'
  | 'unknown';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}

export function isAppError(error: unknown, code?: ErrorCode): error is AppError {
  return error instanceof AppError && (code === undefined || error.code === code);
}

export interface MedNowRepository {
  readonly mode: 'memory' | 'supabase';

  // --- Öffentliche Daten -------------------------------------------------
  search(params: SearchParams, now: Date): Promise<PracticeAvailability[]>;
  getPractice(id: string): Promise<PracticeDetail | null>;
  getSlots(practiceId: string, from: Date, to: Date): Promise<Slot[]>;
  /** Realtime: Slot-Änderungen in Geohash-5-Zellen. Gibt Abmelde-Funktion zurück. */
  subscribeToCells(cells: string[], onChange: (change: SlotChange) => void): () => void;

  // --- Sitzung -------------------------------------------------------------
  ensureSession(): Promise<SessionInfo>;
  requestEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<SessionInfo>;

  // --- Buchen ------------------------------------------------------------
  holdSlot(slotId: string): Promise<HoldResult>;
  releaseHold(slotId: string): Promise<void>;
  bookSlot(input: BookInput): Promise<Appointment>;
  cancelAppointment(appointmentId: string): Promise<void>;
  rescheduleAppointment(
    appointmentId: string,
    newSlotId: string,
    idempotencyKey: string,
  ): Promise<Appointment>;
  listAppointments(): Promise<AppointmentWithDetails[]>;
  getContact(): Promise<BookingContact | null>;

  // --- Familie ------------------------------------------------------------
  listDependents(): Promise<Dependent[]>;
  addDependent(label: string, ageGroup: AgeGroup): Promise<Dependent>;
  removeDependent(id: string): Promise<void>;

  // --- Warteliste --------------------------------------------------------
  joinWaitlist(input: WaitlistInput, center: LatLng): Promise<WaitlistEntry>;
  leaveWaitlist(entryId: string): Promise<void>;
  listWaitlist(): Promise<WaitlistEntryWithLabel[]>;
  listOffers(): Promise<WaitlistOffer[]>;
  respondOffer(
    offerId: string,
    accept: boolean,
    booking?: Omit<BookInput, 'slotId'>,
  ): Promise<Appointment | null>;
  /** Benachrichtigt die App über neue Angebote (Realtime bzw. Demo-Simulation). */
  subscribeToOffers(onOffer: (offer: WaitlistOffer) => void): () => void;
  registerPushToken(
    token: string,
    platform: 'ios' | 'android',
    locale?: string,
    formal?: boolean,
  ): Promise<void>;

  // --- Datenschutz -------------------------------------------------------
  listConsents(): Promise<Consent[]>;
  grantConsent(type: ConsentType, version: string): Promise<void>;
  revokeConsent(type: ConsentType): Promise<void>;
  exportData(): Promise<Record<string, unknown>>;
  deleteAccount(): Promise<void>;
}
