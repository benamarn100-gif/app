import type { Context } from './context.ts';
import { HttpError } from './http.ts';

/**
 * Ebene 1 des Adapter-Musters (docs/architecture.md §2.1): Woher stammt ein Slot,
 * und wer entscheidet über Halten/Buchen/Stornieren?
 *
 * - SeedProvider / PracticeDashboardProvider: Slots liegen in unserer Datenbank,
 *   Buchung atomar über SQL (app.book_slot).
 * - Terminservice116117Provider: nur Machbarkeitsstudie (docs/116117-spike.md).
 */
export type DataSource = 'seed' | 'practice_dashboard' | 'osm' | 'tss_116117';

export type BookArgs = {
  userId: string;
  slotId: string;
  idempotencyKey: string;
  dependentId: string | null;
  reasonCategory: string | null;
  contact: { fullName: string; phone: string; insurance: 'public' | 'private' };
  consentVersion: string;
  viaOfferId?: string | null;
};

export interface AvailabilityProvider {
  readonly id: DataSource;
  readonly mode: 'local' | 'remote';
  hold(ctx: Context, userId: string, slotId: string): Promise<unknown>;
  release(ctx: Context, userId: string, slotId: string): Promise<void>;
  book(ctx: Context, args: BookArgs): Promise<unknown>;
  cancel(ctx: Context, userId: string, appointmentId: string): Promise<void>;
}

class LocalDatabaseProvider implements AvailabilityProvider {
  readonly mode = 'local' as const;
  constructor(readonly id: DataSource) {}

  hold(ctx: Context, userId: string, slotId: string) {
    return ctx.rpc('hold_slot', { p_user: userId, p_slot: slotId });
  }

  async release(ctx: Context, userId: string, slotId: string) {
    await ctx.rpc('release_hold', { p_user: userId, p_slot: slotId });
  }

  book(ctx: Context, a: BookArgs) {
    return ctx.rpc('book_slot', {
      p_user: a.userId,
      p_slot: a.slotId,
      p_idempotency_key: a.idempotencyKey,
      p_dependent: a.dependentId,
      p_reason: a.reasonCategory,
      p_full_name: a.contact.fullName,
      p_phone: a.contact.phone,
      p_insurance: a.contact.insurance,
      p_consent_version: a.consentVersion,
      p_via_offer: a.viaOfferId ?? null,
    });
  }

  async cancel(ctx: Context, userId: string, appointmentId: string) {
    await ctx.rpc('cancel_appointment', { p_user: userId, p_appointment: appointmentId });
  }
}

/** Platzhalter: Anbindung erst nach KBV-Zertifizierung (siehe Spike). */
class Terminservice116117Provider implements AvailabilityProvider {
  readonly id = 'tss_116117' as const;
  readonly mode = 'remote' as const;
  hold(): Promise<unknown> {
    throw new HttpError('not_implemented');
  }
  release(): Promise<void> {
    throw new HttpError('not_implemented');
  }
  book(): Promise<unknown> {
    throw new HttpError('not_implemented');
  }
  cancel(): Promise<void> {
    throw new HttpError('not_implemented');
  }
}

export const SeedProvider = new LocalDatabaseProvider('seed');
export const PracticeDashboardProvider = new LocalDatabaseProvider('practice_dashboard');

export function providerFor(source: DataSource): AvailabilityProvider {
  switch (source) {
    case 'seed':
      return SeedProvider;
    case 'practice_dashboard':
    case 'osm':
      return PracticeDashboardProvider;
    case 'tss_116117':
      return new Terminservice116117Provider();
  }
}

export async function providerForSlot(ctx: Context, slotId: string): Promise<AvailabilityProvider> {
  const rows = await ctx.query<{ source: DataSource }[]>('availability_slots', (q) =>
    q.select('source').eq('id', slotId).limit(1),
  );
  const source = rows?.[0]?.source;
  if (!source) throw new HttpError('not_found');
  return providerFor(source);
}
