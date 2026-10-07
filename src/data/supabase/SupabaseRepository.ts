import {
  createClient,
  FunctionRegion,
  FunctionsFetchError,
  FunctionsHttpError,
  type RealtimeChannel,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { roundLocation } from '@/domain/geo/distance';
import type { PlanId } from '@/domain/plans';
import type {
  AgeGroup,
  Appointment,
  AppointmentWithDetails,
  BookingContact,
  Consent,
  ConsentType,
  Dependent,
  LatLng,
  PracticeAvailability,
  PracticeDetail,
  Slot,
  WaitlistEntry,
  WaitlistOffer,
} from '@/domain/types';

import {
  AppError,
  type BookInput,
  type ErrorCode,
  type HoldResult,
  type MedNowRepository,
  type PlanInfo,
  type SearchParams,
  type SessionInfo,
  type SlotChange,
  type WaitlistEntryWithLabel,
  type WaitlistInput,
} from '../repository';
import { secureSessionStorage } from './secureSessionStorage';

type SearchRow = {
  practice: PracticeAvailability['practice'];
  status: PracticeAvailability['status'];
  open_count: number;
  next_slot: Slot | null;
  distance_m: number;
  last_synced_at: string | null;
};

const ERROR_CODES = new Set<ErrorCode>([
  'slot_taken',
  'hold_expired',
  'consent_missing',
  'verification_required',
  'offer_expired',
  'not_found',
  'rate_limited',
  'plan_limit',
  'invalid_input',
]);

/**
 * Supabase-Implementierung. Lesen über RPC (RLS), Schreiben ausschließlich über
 * Edge Functions mit Regionsbindung eu-central-1. Standort wird vor dem Senden
 * auf ~110 m gerundet.
 */
export class SupabaseRepository implements MedNowRepository {
  readonly mode = 'supabase' as const;
  readonly client: SupabaseClient;
  private pendingEmailMode: 'email_change' | 'email' = 'email_change';

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: {
        storage: secureSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: { headers: { 'x-client-info': `mednow-${Platform.OS}` } },
    });
  }

  // --- Hilfen ------------------------------------------------------------------
  private async rpc<T>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await this.client.rpc(fn, params);
    if (error) throw toAppError(error);
    return data as T;
  }

  private async invoke<T>(
    name: string,
    body: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<T> {
    await this.ensureSession();
    const { data, error } = await this.client.functions.invoke(name, {
      body,
      region: FunctionRegion.EuCentral1,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        let code: ErrorCode = 'unknown';
        try {
          const payload = (await (error.context as Response).json()) as { error?: string };
          if (payload.error && ERROR_CODES.has(payload.error as ErrorCode))
            code = payload.error as ErrorCode;
        } catch {
          // Antwort ohne JSON
        }
        throw new AppError(code);
      }
      if (error instanceof FunctionsFetchError) throw new AppError('network');
      throw new AppError('unknown');
    }
    return data as T;
  }

  // --- Öffentliche Daten -------------------------------------------------------
  async search(params: SearchParams): Promise<PracticeAvailability[]> {
    const center = roundLocation(params.center, 3);
    const rows = await this.rpc<SearchRow[]>('search_availability', {
      p_lat: center.lat,
      p_lng: center.lng,
      p_radius_km: params.radiusKm,
      p_window: params.window,
      p_specialty_ids: params.specialtyIds,
      p_languages: params.languages,
      p_accessibility: params.accessibility,
      p_insurance: params.insurance,
      p_video_only: params.videoOnly,
      p_text: params.text.trim(),
    });
    return rows.map((r) => ({
      practice: r.practice,
      status: r.status,
      openCount: r.open_count,
      nextSlot: r.next_slot,
      distanceM: r.distance_m,
      lastSyncedAt: r.last_synced_at,
    }));
  }

  getPractice(id: string): Promise<PracticeDetail | null> {
    return this.rpc<PracticeDetail | null>('get_practice', { p_id: id });
  }

  getSlots(practiceId: string, from: Date, to: Date): Promise<Slot[]> {
    return this.rpc<Slot[]>('get_slots', {
      p_practice_id: practiceId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
  }

  subscribeToCells(cells: string[], onChange: (change: SlotChange) => void): () => void {
    const channels: RealtimeChannel[] = cells.map((cell) =>
      this.client
        .channel(`slots:geo:${cell}`, { config: { private: true } })
        .on('broadcast', { event: 'slot_changed' }, ({ payload }) =>
          onChange({ slot: payload as Slot }),
        )
        .subscribe(),
    );
    return () => {
      for (const channel of channels) void this.client.removeChannel(channel);
    };
  }

  // --- Sitzung -------------------------------------------------------------------
  async ensureSession(): Promise<SessionInfo> {
    const { data } = await this.client.auth.getSession();
    let user = data.session?.user;
    if (!user) {
      const { data: signIn, error } = await this.client.auth.signInAnonymously();
      if (error || !signIn.user) throw new AppError('network');
      user = signIn.user;
    }
    return { userId: user.id, isAnonymous: user.is_anonymous ?? false, email: user.email ?? null };
  }

  async requestEmailCode(email: string): Promise<void> {
    await this.ensureSession();
    // Anonymes Konto um E-Mail erweitern (Nutzer-ID und Daten bleiben erhalten) …
    const { error } = await this.client.auth.updateUser({ email });
    if (!error) {
      this.pendingEmailMode = 'email_change';
      return;
    }
    // … oder, falls die Adresse schon ein Konto hat, dort anmelden.
    const { error: otpError } = await this.client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (otpError) throw new AppError(otpError.status === 429 ? 'rate_limited' : 'invalid_input');
    this.pendingEmailMode = 'email';
  }

  async verifyEmailCode(email: string, code: string): Promise<SessionInfo> {
    const { data, error } = await this.client.auth.verifyOtp({
      email,
      token: code,
      type: this.pendingEmailMode,
    });
    if (error || !data.user) throw new AppError('invalid_input');
    return {
      userId: data.user.id,
      isAnonymous: data.user.is_anonymous ?? false,
      email: data.user.email ?? email,
    };
  }

  // --- Buchen --------------------------------------------------------------------
  holdSlot(slotId: string): Promise<HoldResult> {
    return this.invoke<HoldResult>('hold_slot', { slotId, action: 'hold' });
  }

  async releaseHold(slotId: string): Promise<void> {
    await this.invoke('hold_slot', { slotId, action: 'release' });
  }

  async bookSlot(input: BookInput): Promise<Appointment> {
    const { appointment } = await this.invoke<{ appointment: Appointment }>(
      'book_slot',
      {
        slotId: input.slotId,
        dependentId: input.dependentId,
        reasonCategory: input.reasonCategory,
        contact: input.contact,
        consentVersion: input.consentVersion,
      },
      input.idempotencyKey,
    );
    return appointment;
  }

  async cancelAppointment(appointmentId: string): Promise<void> {
    await this.invoke('cancel_appointment', { appointmentId });
  }

  async rescheduleAppointment(
    appointmentId: string,
    newSlotId: string,
    idempotencyKey: string,
  ): Promise<Appointment> {
    const { appointment } = await this.invoke<{ appointment: Appointment }>(
      'reschedule_appointment',
      { appointmentId, newSlotId },
      idempotencyKey,
    );
    return appointment;
  }

  async listAppointments(): Promise<AppointmentWithDetails[]> {
    await this.ensureSession();
    return this.rpc<AppointmentWithDetails[]>('get_my_appointments');
  }

  async getContact(): Promise<BookingContact | null> {
    await this.ensureSession();
    return this.rpc<BookingContact | null>('get_my_contact');
  }

  // --- Familie -------------------------------------------------------------------
  async listDependents(): Promise<Dependent[]> {
    await this.ensureSession();
    return this.rpc<Dependent[]>('get_my_dependents');
  }

  async addDependent(label: string, ageGroup: AgeGroup): Promise<Dependent> {
    const { dependent } = await this.invoke<{ dependent: Dependent }>('account', {
      action: 'addDependent',
      label,
      ageGroup,
    });
    return dependent;
  }

  async removeDependent(id: string): Promise<void> {
    await this.invoke('account', { action: 'removeDependent', id });
  }

  // --- Warteliste ----------------------------------------------------------------
  async joinWaitlist(input: WaitlistInput, center: LatLng): Promise<WaitlistEntry> {
    const rounded = roundLocation(center, 3);
    const target =
      input.target.kind === 'specialty'
        ? { kind: 'specialty', specialtyId: input.target.specialtyId }
        : input.target;
    const { entryId } = await this.invoke<{ entryId: string }>('waitlist', {
      action: 'join',
      target,
      days: input.days,
      maxDistanceKm: input.maxDistanceKm,
      center: rounded,
    });
    const now = new Date();
    return {
      id: entryId,
      target:
        input.target.kind === 'specialty' ? { ...input.target, center: rounded } : input.target,
      windowStart: now.toISOString(),
      windowEnd: new Date(now.getTime() + input.days * 864e5).toISOString(),
      maxDistanceKm: input.maxDistanceKm,
      status: 'active',
      createdAt: now.toISOString(),
    };
  }

  async leaveWaitlist(entryId: string): Promise<void> {
    await this.invoke('waitlist', { action: 'leave', entryId });
  }

  async listWaitlist(): Promise<WaitlistEntryWithLabel[]> {
    await this.ensureSession();
    return this.rpc<WaitlistEntryWithLabel[]>('get_my_waitlist');
  }

  async listOffers(): Promise<WaitlistOffer[]> {
    await this.ensureSession();
    return this.rpc<WaitlistOffer[]>('get_my_offers');
  }

  async respondOffer(
    offerId: string,
    accept: boolean,
    booking?: Omit<BookInput, 'slotId'>,
  ): Promise<Appointment | null> {
    const { appointment } = await this.invoke<{ appointment: Appointment | null }>('waitlist', {
      action: 'respond',
      offerId,
      accept,
      idempotencyKey: booking?.idempotencyKey,
      booking: booking
        ? {
            dependentId: booking.dependentId,
            reasonCategory: booking.reasonCategory,
            contact: booking.contact,
            consentVersion: booking.consentVersion,
          }
        : undefined,
    });
    return appointment;
  }

  subscribeToOffers(onOffer: (offer: WaitlistOffer) => void): () => void {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    void this.ensureSession().then(({ userId }) => {
      if (cancelled) return;
      channel = this.client
        .channel(`offers:${userId}`, { config: { private: true } })
        .on('broadcast', { event: 'offer_created' }, async ({ payload }) => {
          const offers = await this.listOffers();
          const offer = offers.find((o) => o.id === (payload as { offerId: string }).offerId);
          if (offer) onOffer(offer);
        })
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void this.client.removeChannel(channel);
    };
  }

  async registerPushToken(
    token: string,
    platform: 'ios' | 'android',
    locale = 'de',
    formal = false,
  ): Promise<void> {
    await this.invoke('account', { action: 'registerPushToken', token, platform, locale, formal });
  }

  // --- Datenschutz -----------------------------------------------------------------
  async listConsents(): Promise<Consent[]> {
    await this.ensureSession();
    const { data, error } = await this.client
      .from('consents')
      .select('type, version, granted_at, revoked_at')
      .order('granted_at', { ascending: false });
    if (error) throw toAppError(error);
    return (data ?? []).map((c) => ({
      type: c.type,
      version: c.version,
      grantedAt: c.granted_at,
      revokedAt: c.revoked_at,
    }));
  }

  async grantConsent(type: ConsentType, version: string): Promise<void> {
    await this.invoke('account', { action: 'grantConsent', type, version });
  }

  async revokeConsent(type: ConsentType): Promise<void> {
    await this.invoke('account', { action: 'revokeConsent', type });
  }

  async exportData(): Promise<Record<string, unknown>> {
    const { export: data } = await this.invoke<{ export: Record<string, unknown> }>('account', {
      action: 'export',
    });
    return data;
  }

  async getPlan(): Promise<PlanInfo> {
    await this.ensureSession();
    const data = await this.rpc<{ plan: PlanId; expiresAt: string | null }>('get_my_plan', {});
    return { plan: data?.plan ?? 'free', expiresAt: data?.expiresAt ?? null };
  }

  async deleteAccount(): Promise<void> {
    await this.invoke('account', { action: 'delete' });
    await this.client.auth.signOut({ scope: 'local' });
  }
}

function toAppError(error: { message?: string; code?: string }): AppError {
  const message = error.message ?? '';
  if (ERROR_CODES.has(message as ErrorCode)) return new AppError(message as ErrorCode);
  if (/fetch|network/i.test(message)) return new AppError('network');
  return new AppError('unknown', message);
}
