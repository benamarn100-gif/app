import { assertEquals } from '@std/assert';

import type { Context } from '../_shared/context.ts';
import {
  handleAccount,
  deleteBillingCustomer,
  handleBillingWebhook,
  handleBookSlot,
  handleSendNotifications,
  handleWaitlist,
} from '../_shared/handlers.ts';
import { errorResponse, serve } from '../_shared/http.ts';
import { offerMessage, type PushSender } from '../_shared/push.ts';

const SLOT = '7a1c2f0e-1111-4c2a-9a3b-1234567890ab';
const USER = '00000000-0000-4000-8000-000000000001';

function fakeContext(
  opts: {
    anonymous?: boolean;
    rpc?: (fn: string, params: Record<string, unknown>) => unknown;
  } = {},
) {
  const calls: { fn: string; params: Record<string, unknown> }[] = [];
  const ctx: Context = {
    admin: null,
    env: (name) => (name === 'WORKER_SECRET' ? 'secret-123' : undefined),
    getUser: () =>
      Promise.resolve({ id: USER, isAnonymous: opts.anonymous ?? false, email: 'a@example.org' }),
    rpc: <T>(fn: string, params: Record<string, unknown>) => {
      calls.push({ fn, params });
      try {
        return Promise.resolve(
          (opts.rpc?.(fn, params) ?? { id: 'appt-1', status: 'confirmed' }) as T,
        );
      } catch (error) {
        return Promise.reject(error);
      }
    },
    query: <T>() => Promise.resolve([{ source: 'seed' }] as T),
  };
  return { ctx, calls };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://example.org/fn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token', ...headers },
    body: JSON.stringify(body),
  });
}

const validBooking = {
  slotId: SLOT,
  dependentId: null,
  reasonCategory: 'checkup',
  contact: { fullName: 'Alex Beispiel', phone: '0661 123456', insurance: 'public' },
  consentVersion: '2026-10-01',
};

Deno.test('book_slot: bucht mit Idempotency-Key aus dem Header über den SeedProvider', async () => {
  const { ctx, calls } = fakeContext();
  const res = await serve((req) => handleBookSlot(req, ctx))(
    post(validBooking, { 'Idempotency-Key': 'abcdef12-key' }),
  );
  assertEquals(res.status, 201);
  assertEquals(calls[0]?.fn, 'book_slot');
  assertEquals(calls[0]?.params.p_idempotency_key, 'abcdef12-key');
  assertEquals(calls[0]?.params.p_user, USER);
});

Deno.test('book_slot: anonyme Sitzung muss erst die E-Mail bestätigen', async () => {
  const { ctx } = fakeContext({ anonymous: true });
  const res = await serve((req) => handleBookSlot(req, ctx))(
    post(validBooking, { 'Idempotency-Key': 'abcdef12-key' }),
  );
  assertEquals(res.status, 403);
  assertEquals((await res.json()).error, 'verification_required');
});

Deno.test('book_slot: ohne Idempotency-Key → invalid_input', async () => {
  const { ctx } = fakeContext();
  const res = await serve((req) => handleBookSlot(req, ctx))(post(validBooking));
  assertEquals(res.status, 400);
});

Deno.test('book_slot: Freitext-Felder werden nicht akzeptiert (nur Kategorien)', async () => {
  const { ctx } = fakeContext();
  const res = await serve((req) => handleBookSlot(req, ctx))(
    post(
      { ...validBooking, reasonCategory: 'Ich habe seit Tagen Kopfschmerzen' },
      { 'Idempotency-Key': 'abcdef12-key' },
    ),
  );
  assertEquals(res.status, 400);
});

Deno.test('book_slot: Datenbankfehler slot_taken → 409', async () => {
  const { ctx } = fakeContext({
    rpc: () => {
      throw { message: 'slot_taken' };
    },
  });
  const res = await serve((req) => handleBookSlot(req, ctx))(
    post(validBooking, { 'Idempotency-Key': 'abcdef12-key' }),
  );
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error, 'slot_taken');
});

Deno.test('waitlist: join mit Fachrichtung übergibt gerundete Mitte an die DB', async () => {
  const { ctx, calls } = fakeContext({ rpc: () => 'entry-1' });
  const res = await serve((req) => handleWaitlist(req, ctx))(
    post({
      action: 'join',
      target: { kind: 'specialty', specialtyId: 3 },
      days: 7,
      maxDistanceKm: 10,
      center: { lat: 50.5558, lng: 9.6808 },
    }),
  );
  assertEquals(res.status, 201);
  assertEquals(calls[0]?.fn, 'join_waitlist');
  assertEquals(calls[0]?.params.p_specialty, 3);
});

Deno.test('waitlist: 60 Tage gehen an die DB, Stufen-Grenze kommt als 402 zurück', async () => {
  const { ctx, calls } = fakeContext({
    rpc: () => {
      throw { message: 'plan_limit' };
    },
  });
  const res = await serve((req) => handleWaitlist(req, ctx))(
    post({
      action: 'join',
      target: { kind: 'specialty', specialtyId: 3 },
      days: 60,
      maxDistanceKm: 10,
    }),
  );
  assertEquals(calls[0]?.params.p_days, 60);
  assertEquals(res.status, 402);
  assertEquals((await res.json()).error, 'plan_limit');
});

Deno.test('waitlist: unbekannte Laufzeit wird abgelehnt', async () => {
  const { ctx, calls } = fakeContext();
  const res = await serve((req) => handleWaitlist(req, ctx))(
    post({
      action: 'join',
      target: { kind: 'practice', practiceId: SLOT },
      days: 90,
      maxDistanceKm: 10,
    }),
  );
  assertEquals(res.status, 400);
  assertEquals(calls.length, 0);
});

Deno.test('waitlist: Angebot annehmen braucht Buchungsdaten', async () => {
  const { ctx } = fakeContext();
  const res = await serve((req) => handleWaitlist(req, ctx))(
    post({ action: 'respond', offerId: SLOT, accept: true }),
  );
  assertEquals(res.status, 400);
});

Deno.test('account: Push-Token mit Sprache registrieren', async () => {
  const { ctx, calls } = fakeContext({ rpc: () => null });
  const res = await serve((req) => handleAccount(req, ctx))(
    post({
      action: 'registerPushToken',
      token: 'ExponentPushToken[abcdefghij]',
      platform: 'ios',
      locale: 'en',
      formal: false,
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(calls[0]?.params.p_locale, 'en');
});

Deno.test('send_notifications: nur mit Worker-Geheimnis', async () => {
  const { ctx } = fakeContext();
  const sender: PushSender = { send: () => Promise.resolve({ invalidTokens: [] }) };
  const res = await serve((req) => handleSendNotifications(req, ctx, sender))(post({}));
  assertEquals(res.status, 401);
});

Deno.test('send_notifications: verschickt datensparsame Texte', async () => {
  const sentBodies: string[] = [];
  const { ctx, calls } = fakeContext({
    rpc: (fn) =>
      fn === 'claim_outbox'
        ? [
            {
              id: 1,
              user_id: USER,
              kind: 'waitlist_offer',
              payload: { offerId: SLOT },
              tokens: [{ token: 't1', locale: 'de', formal: false }],
            },
          ]
        : null,
  });
  const sender: PushSender = {
    send: (targets, build) => {
      for (const t of targets) sentBodies.push(JSON.stringify(build(t)));
      return Promise.resolve({ invalidTokens: [] });
    },
  };
  const res = await serve((req) => handleSendNotifications(req, ctx, sender))(
    post({}, { 'x-worker-secret': 'secret-123' }),
  );
  assertEquals(res.status, 200);
  assertEquals(sentBodies.length, 1);
  assertEquals(
    JSON.parse(sentBodies[0]!).body,
    'Ein Termin in deiner Nähe ist frei geworden. Tippe zum Bestätigen.',
  );
  assertEquals(calls.at(-1)?.fn, 'mark_outbox');
});

Deno.test('send_notifications: Absage durch die Praxis ohne Praxisdetails', async () => {
  const sent: { body: string; data: Record<string, string> }[] = [];
  const { ctx } = fakeContext({
    rpc: (fn) =>
      fn === 'claim_outbox'
        ? [
            {
              id: 2,
              user_id: USER,
              kind: 'appointment_cancelled_by_practice',
              payload: { appointmentId: SLOT },
              tokens: [{ token: 't1', locale: 'de', formal: true }],
            },
          ]
        : null,
  });
  const sender: PushSender = {
    send: (targets, build) => {
      for (const t of targets) sent.push(build(t));
      return Promise.resolve({ invalidTokens: [] });
    },
  };
  const res = await serve((req) => handleSendNotifications(req, ctx, sender))(
    post({}, { 'x-worker-secret': 'secret-123' }),
  );
  assertEquals(res.status, 200);
  assertEquals(sent[0]?.body, 'Die Praxis hat einen Ihrer Termine abgesagt. Details in der App.');
  assertEquals(sent[0]?.data.url, 'mednow://appointments');
});

Deno.test('Push-Texte: Sie-Form und Englisch', () => {
  assertEquals(
    offerMessage({ token: 't', locale: 'de', formal: true }, 'x').body.includes('Ihrer'),
    true,
  );
  assertEquals(
    offerMessage({ token: 't', locale: 'en', formal: false }, 'x').body.startsWith(
      'An appointment',
    ),
    true,
  );
});

Deno.test('Unbekannte Fehler geben keine Details preis', async () => {
  const res = errorResponse(new Error('connection refused to 10.0.0.1'));
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'unknown' });
});

// ---- billing_webhook (Phase 4) ----------------------------------------------

function billingContext() {
  const calls: { fn: string; params: Record<string, unknown> }[] = [];
  const ctx: Context = {
    admin: null,
    env: (name) => (name === 'REVENUECAT_WEBHOOK_SECRET' ? 'rc-secret' : undefined),
    getUser: () => Promise.reject(new Error('kein Nutzer-JWT')),
    rpc: <T>(fn: string, params: Record<string, unknown>) => {
      calls.push({ fn, params });
      return Promise.resolve(null as T);
    },
    query: <T>() => Promise.resolve([] as T),
  };
  return { ctx, calls };
}

const billingPost = (event: Record<string, unknown>, auth = 'Bearer rc-secret') =>
  new Request('https://example.org/billing_webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({ event }),
  });

Deno.test('billing_webhook: ohne gültiges Geheimnis → 401, nichts geschrieben', async () => {
  const { ctx, calls } = billingContext();
  const res = await serve((req) => handleBillingWebhook(req, ctx))(
    billingPost({ type: 'INITIAL_PURCHASE', app_user_id: USER }, 'Bearer falsch'),
  );
  assertEquals(res.status, 401);
  assertEquals(calls.length, 0);
});

Deno.test('billing_webhook: Jahresabo Familie → Stufe family mit Ablaufdatum', async () => {
  const { ctx, calls } = billingContext();
  const expires = Date.UTC(2027, 9, 7);
  const res = await serve((req) => handleBillingWebhook(req, ctx))(
    billingPost({
      type: 'INITIAL_PURCHASE',
      app_user_id: USER,
      entitlement_ids: ['plus', 'family'],
      expiration_at_ms: expires,
      product_id: 'mednow_family_yearly',
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(calls[0]?.fn, 'set_entitlement');
  assertEquals(calls[0]?.params.p_plan, 'family');
  assertEquals(calls[0]?.params.p_expires_at, new Date(expires).toISOString());
});

Deno.test('billing_webhook: Pass ohne Ablauf vom Store → 30 Tage ab Kauf', async () => {
  const { ctx, calls } = billingContext();
  const bought = Date.UTC(2026, 9, 7);
  await serve((req) => handleBillingWebhook(req, ctx))(
    billingPost({
      type: 'NON_RENEWING_PURCHASE',
      app_user_id: USER,
      entitlement_ids: ['plus'],
      purchased_at_ms: bought,
      product_id: 'mednow_plus_pass_30d',
    }),
  );
  assertEquals(calls[0]?.params.p_plan, 'plus');
  assertEquals(calls[0]?.params.p_expires_at, new Date(bought + 30 * 86_400_000).toISOString());
});

Deno.test(
  'billing_webhook: Ablauf → zurück auf kostenlos; anonyme IDs werden ignoriert',
  async () => {
    const { ctx, calls } = billingContext();
    const handler = serve((req) => handleBillingWebhook(req, ctx));
    await handler(billingPost({ type: 'EXPIRATION', app_user_id: USER }));
    assertEquals(calls[0]?.params.p_plan, null);
    const res = await handler(
      billingPost({
        type: 'INITIAL_PURCHASE',
        app_user_id: '$RCAnonymousID:abc',
        entitlement_ids: ['plus'],
      }),
    );
    assertEquals(res.status, 200);
    assertEquals(calls.length, 1);
  },
);

Deno.test(
  'Konto löschen: Kundendatensatz beim Abo-Dienst wird gelöscht, ohne Schlüssel übersprungen',
  async () => {
    const seen: { url: string; method?: string; auth?: string }[] = [];
    const fakeFetch = ((url: string, init?: RequestInit) => {
      seen.push({
        url,
        method: init?.method,
        auth: (init?.headers as Record<string, string> | undefined)?.Authorization,
      });
      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;
    assertEquals(await deleteBillingCustomer(USER, undefined, fakeFetch), false);
    assertEquals(seen.length, 0);
    assertEquals(await deleteBillingCustomer(USER, 'sk_test', fakeFetch), true);
    assertEquals(seen[0]?.method, 'DELETE');
    assertEquals(seen[0]?.url, `https://api.revenuecat.com/v1/subscribers/${USER}`);
    assertEquals(seen[0]?.auth, 'Bearer sk_test');
  },
);
