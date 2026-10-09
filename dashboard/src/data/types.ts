import type {
  AgeGroup,
  AppointmentStatus,
  DataSource,
  Doctor,
  InsuranceType,
  Practice,
  ReasonCategory,
  Slot,
  SlotStatus,
  VisitType,
} from '@app/domain/types';

export type PracticeRole = 'owner' | 'staff';
export type Membership = { practice: Practice; role: PracticeRole };

/** Slot mit Quelle und – falls über Terminlücke gebucht – der Termin-ID (ohne Personendaten). */
export type DashboardSlot = Slot & { source: DataSource; appointmentId: string | null };

export type WeekData = {
  role: PracticeRole;
  practice: Practice;
  doctors: Doctor[];
  slots: DashboardSlot[];
  lastSyncedAt: string | null;
  serverNow: string;
};

export type BookingContact = { fullName: string; phone: string; insurance: InsuranceType };

export type Booking = {
  id: string;
  slotId: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  visitType: VisitType;
  status: AppointmentStatus;
  reasonCategory: ReasonCategory | null;
  forDependent: boolean;
  dependentAgeGroup: AgeGroup | null;
  /** Nur bei bestätigten Terminen (Datensparsamkeit). */
  contact: BookingContact | null;
  createdAt: string;
  cancelledAt: string | null;
};

/** Wiederkehrende Sprechzeit. Wochentag nach ISO 8601 (1 = Montag), Zeiten in Berlin. */
export type SlotTemplate = {
  id: string;
  doctorId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  visitType: VisitType;
};
export type NewTemplateInput = Omit<SlotTemplate, 'id'>;

export type NewSlotInput = {
  doctorId: string;
  startsAt: Date;
  minutes: number;
  visitType: VisitType;
};

export type LiveEvent = { slotId: string; status: SlotStatus };

export const ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'mfa_required',
  'invalid_input',
  'slot_overlap',
  'slot_booked',
  'slot_held',
  'template_overlap',
  'not_found',
  'invalid_code',
  'rate_limited',
  'network',
  'unknown',
] as const;
export type DashboardErrorCode = (typeof ERROR_CODES)[number];

export class DashboardError extends Error {
  constructor(readonly code: DashboardErrorCode) {
    super(code);
    this.name = 'DashboardError';
  }
}

export function errorCode(error: unknown): DashboardErrorCode {
  return error instanceof DashboardError ? error.code : 'unknown';
}

export type AuthState =
  | { kind: 'signedOut' }
  | { kind: 'mfa'; enrolled: boolean; email: string | null }
  | { kind: 'ready'; email: string | null };

export type TotpEnrollment = { factorId: string; qrCode: string; secret: string };

export interface DashboardAuth {
  current(): Promise<AuthState>;
  onChange(listener: () => void): () => void;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  startTotpEnrollment(): Promise<TotpEnrollment>;
  verifyTotp(code: string, factorId?: string): Promise<void>;
  signOut(): Promise<void>;
  /** Nur im Demo-Modus: ohne Anmeldung öffnen. */
  signInDemo?: () => Promise<void>;
}

/**
 * Datenzugriff des Dashboards. Implementierungen: SupabaseDashboardRepository (RPCs mit
 * Mitgliedschafts- und aal2-Prüfung) und DemoDashboardRepository (fiktive Praxis im Speicher).
 */
export interface DashboardRepository {
  readonly mode: 'demo' | 'supabase';
  readonly auth: DashboardAuth;
  myPractices(): Promise<Membership[]>;
  week(practiceId: string, from: Date, to: Date): Promise<WeekData>;
  bookings(practiceId: string, from: Date, to: Date): Promise<Booking[]>;
  templates(practiceId: string): Promise<SlotTemplate[]>;
  createSlot(practiceId: string, input: NewSlotInput): Promise<DashboardSlot>;
  cancelSlot(practiceId: string, slotId: string): Promise<void>;
  cancelAppointment(practiceId: string, appointmentId: string): Promise<void>;
  addTemplate(practiceId: string, input: NewTemplateInput): Promise<SlotTemplate>;
  deleteTemplate(practiceId: string, templateId: string): Promise<void>;
  /** Wendet alle Vorlagen ab `fromDate` (YYYY-MM-DD, Montag) für `weeks` Wochen an. */
  applyTemplates(practiceId: string, fromDate: string, weeks: number): Promise<number>;
  confirmAvailability(practiceId: string): Promise<string>;
  /** Live-Änderungen an Slots der Praxis (Realtime bzw. Demo-Simulation). */
  subscribe(practice: Practice, listener: (event: LiveEvent) => void): () => void;
}
