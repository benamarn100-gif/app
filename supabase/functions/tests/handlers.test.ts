import { assertEquals } from '@std/assert';

import type { Context } from '../_shared/context.ts';
import {
  handleAccount,
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
