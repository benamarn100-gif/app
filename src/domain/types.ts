/**
 * Domain-Typen. Reines TypeScript – keine React-/RN-Importe.
 * Zeiten sind ISO-8601-Strings in UTC; Anzeige erfolgt in Europe/Berlin.
 */

export type LatLng = { lat: number; lng: number };

export type AvailabilityStatus = 'free' | 'few' | 'booked' | 'unknown';
export type SlotStatus = 'open' | 'held' | 'booked' | 'cancelled';
export type HoldReason = 'checkout' | 'waitlist_offer';
export type VisitType = 'in_person' | 'video';
export type TimeWindow = 'today' | 'tomorrow' | 'week';
export type InsuranceType = 'public' | 'private';

export const AGE_GROUPS = [
  'child_0_5',
  'child_6_12',
  'teen_13_17',
  'adult_18_39',
  'adult_40_64',
  'senior_65_plus',
] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const SPECIALTY_SLUGS = [
  'allgemeinmedizin',
  'innere-medizin',
  'kinder-jugendmedizin',
  'frauenheilkunde',
  'hno',
  'augenheilkunde',
  'dermatologie',
  'orthopaedie',
  'zahnmedizin',
  'neurologie',
  'urologie',
  'psychiatrie-psychotherapie',
] as const;
export type SpecialtySlug = (typeof SPECIALTY_SLUGS)[number];

export type Specialty = {
  id: number;
  slug: SpecialtySlug;
  nameDe: string;
  nameEn: string;
  /** Lucide-Iconname, siehe src/components/SpecialtyIcon.tsx */
  icon: string;
};

export type Address = { street: string; postalCode: string; city: string };

export const ACCESSIBILITY_FEATURES = [
  'wheelchair',
  'stepFree',
  'elevator',
  'accessibleToilet',
  'parking',
  'hearingLoop',
] as const;
export type AccessibilityFeature = (typeof ACCESSIBILITY_FEATURES)[number];
export type PracticeAccessibility = Record<AccessibilityFeature, boolean>;

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
/** Sprechzeiten in Berliner Ortszeit, z. B. { mon: [{ open: '08:00', close: '12:00' }] } */
export type OpeningHours = Partial<Record<Weekday, { open: string; close: string }[]>>;

export type Rating = { average: number; count: number };

export type DataSource = 'seed' | 'practice_dashboard' | 'osm' | 'tss_116117';

export type Practice = {
  id: string;
  name: string;
  address: Address;
  location: LatLng;
  phone: string | null;
  website: string | null;
  /** ISO-639-1-Codes, z. B. ['de', 'en', 'tr'] */
  languages: string[];
  accessibility: PracticeAccessibility;
  acceptsPublic: boolean;
  acceptsPrivate: boolean;
  offersVideo: boolean;
  openingHours: OpeningHours;
  services: string[];
  photoUrl: string | null;
  photoBlurhash: string | null;
  rating: Rating | null;
  specialtyIds: number[];
  isDemo: boolean;
  source: DataSource;
  sourceLicense: string;
  verifiedAt: string | null;
};

export type Doctor = {
  id: string;
  practiceId: string;
  name: string;
  specialtyIds: number[];
  languages: string[];
  photoUrl: string | null;
};

export type Slot = {
  id: string;
  doctorId: string;
  practiceId: string;
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
  heldUntil: string | null;
  holdReason: HoldReason | null;
  visitType: VisitType;
  updatedAt: string;
};

export type PracticeAvailability = {
  practice: Practice;
  status: AvailabilityStatus;
  openCount: number;
  nextSlot: Slot | null;
  distanceM: number | null;
  /** Letzter Abgleich der Datenquelle – Grundlage für „Aktualisiert vor X Min.“ */
  lastSyncedAt: string | null;
};

export type PracticeDetail = {
  practice: Practice;
  doctors: Doctor[];
  lastSyncedAt: string | null;
};

export const REASON_CATEGORIES = [
  'acute',
  'checkup',
  'follow_up',
  'prescription',
  'vaccination',
  'certificate',
  'other',
] as const;
export type ReasonCategory = (typeof REASON_CATEGORIES)[number];

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed';

export type Appointment = {
  id: string;
  slotId: string;
  practiceId: string;
  doctorId: string;
  dependentId: string | null;
  reasonCategory: ReasonCategory | null;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  visitType: VisitType;
  createdAt: string;
  cancelledAt: string | null;
};

export type AppointmentWithDetails = Appointment & {
  practice: Practice;
  doctor: Doctor;
  patientLabel: string | null;
};

export type Dependent = { id: string; label: string; ageGroup: AgeGroup };

export type WaitlistTarget =
  | { kind: 'practice'; practiceId: string }
  | { kind: 'doctor'; doctorId: string }
  | { kind: 'specialty'; specialtyId: number; center: LatLng };

export type WaitlistStatus = 'active' | 'fulfilled' | 'cancelled' | 'expired';

export type WaitlistEntry = {
  id: string;
  target: WaitlistTarget;
  windowStart: string;
  windowEnd: string;
  maxDistanceKm: number;
  status: WaitlistStatus;
  createdAt: string;
};

export type OfferStatus = 'pending' | 'accepted' | 'expired' | 'declined';

export type WaitlistOffer = {
  id: string;
  entryId: string;
  slot: Slot;
  practice: Practice;
  doctor: Doctor;
  offeredAt: string;
  expiresAt: string;
  status: OfferStatus;
};

export type BookingContact = {
  fullName: string;
  phone: string;
  insurance: InsuranceType;
};

export type ConsentType =
  'health_data' | 'terms' | 'privacy' | 'push' | 'crash_reports' | 'analytics';

export type Consent = {
  type: ConsentType;
  version: string;
  grantedAt: string;
  revokedAt: string | null;
};
