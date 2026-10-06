import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

import { brand } from '@app/config/brand';
import { encodeGeohash } from '@app/domain/geo/geohash';
import type { Practice } from '@app/domain/types';

import {
  DashboardError,
  ERROR_CODES,
  type AuthState,
  type Booking,
  type DashboardAuth,
  type DashboardErrorCode,
  type DashboardRepository,
  type DashboardSlot,
  type LiveEvent,
  type Membership,
  type NewSlotInput,
  type NewTemplateInput,
  type SlotTemplate,
  type TotpEnrollment,
  type WeekData,
} from './types';

type SupabaseLikeError = { message?: string; code?: string; status?: number; name?: string };

/** Übersetzt Fehler aus RPC/Auth in stabile Codes; technische Details bleiben intern. */
export function toDashboardError(error: SupabaseLikeError | null | undefined): DashboardError {
  const message = error?.message ?? '';
  if ((ERROR_CODES as readonly string[]).includes(message)) {
    return new DashboardError(message as DashboardErrorCode);
  }
  if (error?.status === 429 || error?.code === 'over_request_rate_limit') {
    return new DashboardError('rate_limited');
  }
  if (error?.code === 'otp_expired' || error?.code === 'mfa_verification_failed') {
    return new DashboardError('invalid_code');
  }
  if (error?.code === 'PGRST301' || error?.status === 401)
    return new DashboardError('unauthorized');
  if (/fetch|network/i.test(message) || error?.name === 'AuthRetryableFetchError') {
    return new DashboardError('network');
  }
  return new DashboardError('unknown');
}

/** Sitzung nur im sessionStorage: endet mit dem Tab (gemeinsam genutzte Praxisrechner). */
export function createDashboardClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      storage: window.sessionStorage,
      storageKey: 'mednow-dashboard-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: { headers: { 'x-client-info': 'mednow-dashboard' } },
  });
}

class SupabaseDashboardAuth implements DashboardAuth {
  constructor(private readonly client: SupabaseClient) {}

  async current(): Promise<AuthState> {
    const { data } = await this.client.auth.getSession();
    const session = data.session;
    if (!session || session.user.is_anonymous) return { kind: 'signedOut' };
    const email = session.user.email ?? null;
    const aal = await this.client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.error) throw toDashboardError(aal.error);
    if (aal.data.currentLevel === 'aal2') return { kind: 'ready', email };
    const factors = await this.client.auth.mfa.listFactors();
    if (factors.error) throw toDashboardError(factors.error);
    const enrolled = factors.data.totp.some((f) => f.status === 'verified');
    return { kind: 'mfa', enrolled, email };
  }

  onChange(listener: () => void) {
    // Callback nicht synchron weiterreichen: Supabase-Aufrufe im Callback blockieren sonst.
    const { data } = this.client.auth.onAuthStateChange(() => setTimeout(listener, 0));
    return () => data.subscription.unsubscribe();
  }

  async sendCode(email: string) {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    // Unbekannte Adressen nicht verraten (keine Konten-Ermittlung): gleiche Antwort.
    if (error && error.code !== 'otp_disabled' && error.code !== 'signup_disabled') {
      throw toDashboardError(error);
    }
  }

  async verifyCode(email: string, code: string) {
    const { error } = await this.client.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error)
      throw error.status === 403 ? new DashboardError('invalid_code') : toDashboardError(error);
  }

  async startTotpEnrollment(): Promise<TotpEnrollment> {
    const factors = await this.client.auth.mfa.listFactors();
    if (factors.error) throw toDashboardError(factors.error);
    // Abgebrochene Einrichtungen aufräumen, sonst kollidiert der Name.
    for (const factor of factors.data.all) {
      if (factor.factor_type === 'totp' && factor.status === 'unverified') {
        await this.client.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
    const { data, error } = await this.client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `${brand.name} Praxis`,
    });
    if (error || !data) throw toDashboardError(error);
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  }

  async verifyTotp(code: string, factorId?: string) {
    let id = factorId;
    if (!id) {
      const factors = await this.client.auth.mfa.listFactors();
      id = factors.data?.totp.find((f) => f.status === 'verified')?.id;
    }
    if (!id) throw new DashboardError('mfa_required');
    const { error } = await this.client.auth.mfa.challengeAndVerify({ factorId: id, code });
    if (error)
      throw error.status === 422 || error.status === 400
        ? new DashboardError('invalid_code')
        : toDashboardError(error);
  }

  async signOut() {
    await this.client.auth.signOut();
  }
}

/**
 * Zugriff über security-definer-RPCs (supabase/migrations/…_practice_dashboard.sql):
 * Mitgliedschaft und Zwei-Faktor-Anmeldung (aal2) prüft die Datenbank.
 */
export class SupabaseDashboardRepository implements DashboardRepository {
  readonly mode = 'supabase' as const;
  readonly auth: DashboardAuth;

  constructor(private readonly client: SupabaseClient) {
    this.auth = new SupabaseDashboardAuth(client);
  }

  private async rpc<T>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
    try {
      const { data, error } = await this.client.rpc(fn, params);
      if (error) throw toDashboardError(error);
      return data as T;
    } catch (error) {
      if (error instanceof DashboardError) throw error;
      throw toDashboardError(error as SupabaseLikeError);
    }
  }

  myPractices() {
    return this.rpc<Membership[]>('dashboard_my_practices');
  }

  week(practiceId: string, from: Date, to: Date) {
    return this.rpc<WeekData>('dashboard_week', {
      p_practice: practiceId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
  }

  bookings(practiceId: string, from: Date, to: Date) {
    return this.rpc<Booking[]>('dashboard_bookings', {
      p_practice: practiceId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
  }

  templates(practiceId: string) {
    return this.rpc<SlotTemplate[]>('dashboard_templates', { p_practice: practiceId });
  }

  createSlot(practiceId: string, input: NewSlotInput) {
    return this.rpc<DashboardSlot>('dashboard_create_slot', {
      p_practice: practiceId,
      p_doctor: input.doctorId,
      p_starts_at: input.startsAt.toISOString(),
      p_minutes: input.minutes,
      p_visit_type: input.visitType,
    });
  }

  cancelSlot(practiceId: string, slotId: string) {
    return this.rpc<void>('dashboard_cancel_slot', { p_practice: practiceId, p_slot: slotId });
  }

  cancelAppointment(practiceId: string, appointmentId: string) {
    return this.rpc<void>('dashboard_cancel_appointment', {
      p_practice: practiceId,
      p_appointment: appointmentId,
    });
  }

  addTemplate(practiceId: string, input: NewTemplateInput) {
    return this.rpc<SlotTemplate>('dashboard_add_template', {
      p_practice: practiceId,
      p_doctor: input.doctorId,
      p_weekday: input.weekday,
      p_start: input.startTime,
      p_end: input.endTime,
      p_minutes: input.slotMinutes,
      p_visit_type: input.visitType,
    });
  }

  deleteTemplate(practiceId: string, templateId: string) {
    return this.rpc<void>('dashboard_delete_template', {
      p_practice: practiceId,
      p_template: templateId,
    });
  }

  applyTemplates(practiceId: string, fromDate: string, weeks: number) {
    return this.rpc<number>('dashboard_apply_templates', {
      p_practice: practiceId,
      p_from: fromDate,
      p_weeks: weeks,
    });
  }

  confirmAvailability(practiceId: string) {
    return this.rpc<string>('dashboard_confirm_availability', { p_practice: practiceId });
  }

  /** Gleiches Realtime-Topic wie die App (Geohash-5-Zelle), gefiltert auf die eigene Praxis. */
  subscribe(practice: Practice, listener: (event: LiveEvent) => void): () => void {
    const cell = encodeGeohash(practice.location, 5);
    const channel: RealtimeChannel = this.client
      .channel(`slots:geo:${cell}`, { config: { private: true } })
      .on('broadcast', { event: 'slot_changed' }, ({ payload }) => {
        const slot = payload as Partial<DashboardSlot> | undefined;
        if (slot?.practiceId === practice.id && slot.id && slot.status) {
          listener({ slotId: slot.id, status: slot.status });
        }
      })
      .subscribe();
    return () => {
      void this.client.removeChannel(channel);
    };
  }
}
