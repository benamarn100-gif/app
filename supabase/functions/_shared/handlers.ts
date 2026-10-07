import { z } from 'zod';

import { providerForSlot } from './availability.ts';
import type { Context } from './context.ts';
import { HttpError, json, readJson } from './http.ts';
import { messageFor, type PushSender, type PushTarget } from './push.ts';
import { bookingDetails, idempotencyKey, parse, readIdempotencyKey, uuid } from './validation.ts';

/**
 * Fachlogik der Edge Functions als reine Funktionen (Context injiziert) –
 * dadurch ohne laufendes Supabase testbar (supabase/functions/tests).
 */

function requireVerified(user: { isAnonymous: boolean }) {
  // Buchungen nur mit bestätigter E-Mail (docs/decisions.md D-24)
  if (user.isAnonymous) throw new HttpError('verification_required');
}

export async function handleBookSlot(req: Request, ctx: Context): Promise<Response> {
  const user = await ctx.getUser(req);
  requireVerified(user);
  const body = (await readJson(req)) as Record<string, unknown>;
  const key = readIdempotencyKey(req, body);
  const input = parse(bookingDetails.extend({ slotId: uuid }), body);
  const provider = await providerForSlot(ctx, input.slotId);
  const appointment = await provider.book(ctx, { ...input, userId: user.id, idempotencyKey: key });
  return json({ appointment }, 201);
}

export async function handleHoldSlot(req: Request, ctx: Context): Promise<Response> {
  const user = await ctx.getUser(req);
  const body = parse(
    z.object({ slotId: uuid, action: z.enum(['hold', 'release']).default('hold') }),
    await readJson(req),
  );
  const provider = await providerForSlot(ctx, body.slotId);
  if (body.action === 'release') {
    await provider.release(ctx, user.id, body.slotId);
    return json({ ok: true });
  }
  return json(await provider.hold(ctx, user.id, body.slotId));
}

export async function handleCancelAppointment(req: Request, ctx: Context): Promise<Response> {
  const user = await ctx.getUser(req);
  const body = parse(z.object({ appointmentId: uuid }), await readJson(req));
  await ctx.rpc('cancel_appointment', { p_user: user.id, p_appointment: body.appointmentId });
  return json({ ok: true });
}

export async function handleReschedule(req: Request, ctx: Context): Promise<Response> {
  const user = await ctx.getUser(req);
  requireVerified(user);
  const raw = (await readJson(req)) as Record<string, unknown>;
  const key = readIdempotencyKey(req, raw);
  const body = parse(z.object({ appointmentId: uuid, newSlotId: uuid }), raw);
  const appointment = await ctx.rpc('reschedule_appointment', {
    p_user: user.id,
    p_appointment: body.appointmentId,
    p_new_slot: body.newSlotId,
    p_idempotency_key: key,
  });
  return json({ appointment });
}

const waitlistSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('join'),
    target: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('practice'), practiceId: uuid }),
      z.object({ kind: z.literal('doctor'), doctorId: uuid }),
      z.object({ kind: z.literal('specialty'), specialtyId: z.number().int().min(1).max(99) }),
    ]),
    // 30/60 nur mit Plus/Familie – das prüft join_waitlist (Fehler plan_limit)
    days: z.union([
      z.literal(1),
      z.literal(3),
      z.literal(7),
      z.literal(14),
      z.literal(30),
      z.literal(60),
    ]),
    maxDistanceKm: z.number().int().min(1).max(50),
    center: z
      .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
      .nullable()
      .default(null),
  }),
  z.object({ action: z.literal('leave'), entryId: uuid }),
  z.object({
    action: z.literal('respond'),
    offerId: uuid,
    accept: z.boolean(),
    idempotencyKey: idempotencyKey.optional(),
    booking: bookingDetails.optional(),
  }),
]);

export async function handleWaitlist(req: Request, ctx: Context): Promise<Response> {
  const user = await ctx.getUser(req);
  const body = parse(waitlistSchema, await readJson(req));
  switch (body.action) {
    case 'join': {
      const t = body.target;
      const id = await ctx.rpc<string>('join_waitlist', {
        p_user: user.id,
        p_practice: t.kind === 'practice' ? t.practiceId : null,
        p_doctor: t.kind === 'doctor' ? t.doctorId : null,
        p_specialty: t.kind === 'specialty' ? t.specialtyId : null,
        p_lat: body.center?.lat ?? null,
        p_lng: body.center?.lng ?? null,
        p_days: body.days,
        p_max_km: body.maxDistanceKm,
      });
      return json({ entryId: id }, 201);
    }
    case 'leave':
      await ctx.rpc('leave_waitlist', { p_user: user.id, p_entry: body.entryId });
      return json({ ok: true });
    case 'respond': {
      if (body.accept) {
        requireVerified(user);
        if (!body.booking || !body.idempotencyKey) throw new HttpError('invalid_input');
      }
      const appointment = await ctx.rpc('respond_offer', {
        p_user: user.id,
        p_offer: body.offerId,
        p_accept: body.accept,
        p_idempotency_key: body.idempotencyKey ?? null,
        p_dependent: body.booking?.dependentId ?? null,
        p_reason: body.booking?.reasonCategory ?? null,
        p_full_name: body.booking?.contact.fullName ?? null,
        p_phone: body.booking?.contact.phone ?? null,
        p_insurance: body.booking?.contact.insurance ?? null,
        p_consent_version: body.booking?.consentVersion ?? null,
      });
      return json({ appointment: appointment ?? null });
    }
  }
}

const accountSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('profile'),
    ageGroup: z
      .enum([
        'child_0_5',
        'child_6_12',
        'teen_13_17',
        'adult_18_39',
        'adult_40_64',
        'senior_65_plus',
      ])
      .nullable(),
    radiusKm: z.number().int().min(1).max(50),
    preferredSpecialties: z.array(z.number().int().min(1).max(99)).max(12),
    formalAddress: z.boolean(),
    homeLabel: z.string().max(40).nullable(),
    home: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  }),
  z.object({
    action: z.literal('addDependent'),
    label: z.string().trim().min(1).max(40),
    ageGroup: z.enum([
      'child_0_5',
      'child_6_12',
      'teen_13_17',
      'adult_18_39',
      'adult_40_64',
      'senior_65_plus',
    ]),
  }),
  z.object({ action: z.literal('removeDependent'), id: uuid }),
  z.object({
    action: z.literal('grantConsent'),
    type: z.enum(['health_data', 'terms', 'privacy', 'push', 'crash_reports', 'analytics']),
    version: z.string().min(1).max(20),
  }),
  z.object({
    action: z.literal('revokeConsent'),
    type: z.enum(['health_data', 'terms', 'privacy', 'push', 'crash_reports', 'analytics']),
  }),
  z.object({
    action: z.literal('registerPushToken'),
    token: z.string().min(10).max(255),
    platform: z.enum(['ios', 'android']),
    locale: z.enum(['de', 'en']).default('de'),
    formal: z.boolean().default(false),
  }),
  z.object({ action: z.literal('export') }),
  z.object({ action: z.literal('delete') }),
]);

export async function handleAccount(req: Request, ctx: Context): Promise<Response> {
  const user = await ctx.getUser(req);
  const body = parse(accountSchema, await readJson(req));
  switch (body.action) {
    case 'profile':
      await ctx.rpc('upsert_profile', {
        p_user: user.id,
        p_age_group: body.ageGroup,
        p_radius_km: body.radiusKm,
        p_preferred: body.preferredSpecialties,
        p_formal: body.formalAddress,
        p_home_label: body.homeLabel,
        p_home_lat: body.home?.lat ?? null,
        p_home_lng: body.home?.lng ?? null,
      });
      return json({ ok: true });
    case 'addDependent':
      return json(
        {
          dependent: await ctx.rpc('add_dependent', {
            p_user: user.id,
            p_label: body.label,
            p_age_group: body.ageGroup,
          }),
        },
        201,
      );
    case 'removeDependent':
      await ctx.rpc('remove_dependent', { p_user: user.id, p_id: body.id });
      return json({ ok: true });
    case 'grantConsent':
      await ctx.rpc('grant_consent', {
        p_user: user.id,
        p_type: body.type,
        p_version: body.version,
      });
      return json({ ok: true });
    case 'revokeConsent':
      await ctx.rpc('revoke_consent', { p_user: user.id, p_type: body.type });
      return json({ ok: true });
    case 'registerPushToken':
      await ctx.rpc('register_push_token', {
        p_user: user.id,
        p_token: body.token,
        p_platform: body.platform,
        p_locale: body.locale,
        p_formal: body.formal,
      });
      return json({ ok: true });
    case 'export':
      return json({ export: await ctx.rpc('export_user_data', { p_user: user.id }) });
    case 'delete': {
      await ctx.rpc('delete_user_data', { p_user: user.id });
      // Abo-Dienst: Kundendatensatz löschen (nur pseudonyme ID gespeichert). Ohne geheimen
      // Schlüssel übersprungen – dann manuell im RevenueCat-Dashboard (docs/billing-setup.md).
      await deleteBillingCustomer(user.id, ctx.env('REVENUECAT_SECRET_API_KEY'));
      if (ctx.admin) {
        const { error } = await ctx.admin.auth.admin.deleteUser(user.id);
        if (error) throw error;
      }
      return json({ ok: true });
    }
  }
}

type OutboxRow = {
  id: number;
  user_id: string;
  kind: string;
  payload: { offerId?: string; appointmentId?: string };
  tokens: PushTarget[];
};

/** Worker: leert die Push-Outbox (aufgerufen per pg_net/pg_cron mit gemeinsamem Geheimnis). */
export async function handleSendNotifications(
  req: Request,
  ctx: Context,
  sender: PushSender,
): Promise<Response> {
  const secret = ctx.env('WORKER_SECRET');
  if (!secret || req.headers.get('x-worker-secret') !== secret) throw new HttpError('unauthorized');
  const rows = await ctx.rpc<OutboxRow[]>('claim_outbox', { p_limit: 50 });
  let sent = 0;
  const failed: number[] = [];
  for (const row of rows ?? []) {
    try {
      const build = messageFor(row.kind, row.payload);
      if (build) {
        const { invalidTokens } = await sender.send(row.tokens, build);
        if (invalidTokens.length && ctx.admin) {
          await ctx.admin.from('push_tokens').delete().in('token', invalidTokens);
        }
      }
      sent++;
    } catch {
      failed.push(row.id);
    }
  }
  const ok = (rows ?? []).map((r) => r.id).filter((id) => !failed.includes(id));
  if (ok.length) await ctx.rpc('mark_outbox', { p_ids: ok, p_error: null });
  if (failed.length) await ctx.rpc('mark_outbox', { p_ids: failed, p_error: 'send_failed' });
  return json({ sent, failed: failed.length });
}

// ---- Abo-Stufen (Phase 4) ---------------------------------------------------

/** Löscht den Kundendatensatz bei RevenueCat (DSGVO Art. 17). Fehler blockieren das Löschen nicht. */
export async function deleteBillingCustomer(
  userId: string,
  secretKey: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!secretKey) return false;
  try {
    const res = await fetcher(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${secretKey}` } },
    );
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

const PASS_PRODUCT = 'mednow_plus_pass_30d';
const PASS_DAYS = 30;

const billingEvent = z.object({
  event: z
    .object({
      type: z.string(),
      app_user_id: z.string(),
      entitlement_ids: z.array(z.string()).nullable().optional(),
      expiration_at_ms: z.number().nullable().optional(),
      purchased_at_ms: z.number().nullable().optional(),
      product_id: z.string().nullable().optional(),
    })
    .passthrough(),
});

/** Ereignisse, nach denen die Stufe aus den aktiven Entitlements neu gesetzt wird. */
const GRANTING = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  // Kündigung/Zahlungsproblem: läuft bis zum Ablaufdatum weiter
  'CANCELLATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Webhook von RevenueCat (verify_jwt = false). Echtheit über das gemeinsame Geheimnis
 * REVENUECAT_WEBHOOK_SECRET im Authorization-Header („Bearer <Geheimnis>“).
 * Schreibt nur Stufe + Ablaufdatum in app.entitlements – keine Kaufdaten, kein Protokoll
 * des Inhalts. Die App-Nutzer-ID ist die pseudonyme Supabase-ID; anonyme RevenueCat-IDs
 * werden ignoriert.
 */
export async function handleBillingWebhook(req: Request, ctx: Context): Promise<Response> {
  const secret = ctx.env('REVENUECAT_WEBHOOK_SECRET');
  const header = req.headers.get('authorization') ?? '';
  if (!secret || !sameSecret(header, `Bearer ${secret}`)) throw new HttpError('unauthorized');
  const { event } = parse(billingEvent, await readJson(req));

  if (!uuid.safeParse(event.app_user_id).success) return json({ ignored: 'anonymous' });
  const user = event.app_user_id;

  if (event.type === 'EXPIRATION') {
    await ctx.rpc('set_entitlement', {
      p_user: user,
      p_plan: null,
      p_expires_at: null,
      p_product: null,
    });
    return json({ ok: true, plan: 'free' });
  }
  if (!GRANTING.has(event.type)) return json({ ignored: event.type });

  const ids = event.entitlement_ids ?? [];
  const plan = ids.includes('family') ? 'family' : ids.includes('plus') ? 'plus' : null;
  if (!plan) return json({ ignored: 'no_entitlement' });

  // Pass ohne Ablaufdatum vom Store: 30 Tage ab Kauf. Sonst nie „für immer“ freischalten.
  const expiresMs =
    event.expiration_at_ms ??
    (event.product_id === PASS_PRODUCT && event.purchased_at_ms
      ? event.purchased_at_ms + PASS_DAYS * 86_400_000
      : null);
  if (!expiresMs) return json({ ignored: 'no_expiration' });

  await ctx.rpc('set_entitlement', {
    p_user: user,
    p_plan: plan,
    p_expires_at: new Date(expiresMs).toISOString(),
    p_product: event.product_id ?? null,
  });
  return json({ ok: true, plan });
}
