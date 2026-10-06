-- DoD Phase 4: Slot wird frei → passende Person bekommt Push (Outbox),
-- Reservierung läuft nach 10 Minuten ab und die nächste Person rückt nach (FIFO).
begin;
select plan(17);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000aa', 'first@example.org', false),
  ('00000000-0000-4000-8000-0000000000bb', 'second@example.org', false),
  ('00000000-0000-4000-8000-0000000000cc', 'owner@example.org', false);
select app.grant_consent(u, 'health_data', '2026-10-01')
  from unnest(array['00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000cc']::uuid[]) u;

-- Ausgangslage: C hat einen Termin in einer Praxis
create temp table t as
  select s.id as slot_id, s.practice_id
  from public.availability_slots s
  where s.status = 'open' and s.starts_at > app.now() + interval '2 hours'
  order by s.starts_at limit 1;
select app.book_slot('00000000-0000-4000-8000-0000000000cc', (select slot_id from t), 'owner-key-1', null, null, 'Carla C', '0661 111111', 'public', '2026-10-01');

-- A trägt sich zuerst ein, dann B (FIFO nach Eintragszeit)
select ok(
  app.join_waitlist('00000000-0000-4000-8000-0000000000aa', (select practice_id from t), null, null, null, null, 14, 10) is not null,
  'A steht auf der Warteliste'
);
update public.waitlist_entries set created_at = app.now() - interval '2 minutes' where user_id = '00000000-0000-4000-8000-0000000000aa';
select ok(
  app.join_waitlist('00000000-0000-4000-8000-0000000000bb', (select practice_id from t), null, null, null, null, 14, 10) is not null,
  'B steht auf der Warteliste'
);
update public.waitlist_entries set created_at = app.now() - interval '1 minute' where user_id = '00000000-0000-4000-8000-0000000000bb';

-- C storniert → Slot wird frei → Angebot an A
select app.cancel_appointment('00000000-0000-4000-8000-0000000000cc',
  (select id from public.appointments where user_id = '00000000-0000-4000-8000-0000000000cc'));

select is(
  (select user_id from public.waitlist_offers where slot_id = (select slot_id from t) and status = 'pending'),
  '00000000-0000-4000-8000-0000000000aa'::uuid,
  'Erste Person (A) bekommt das Angebot'
);
select is(
  (select status::text || '/' || hold_reason::text from public.availability_slots where id = (select slot_id from t)),
  'held/waitlist_offer',
  'Slot ist für A reserviert'
);
select is(
  (select held_until - app.now() from public.availability_slots where id = (select slot_id from t)),
  interval '10 minutes',
  'Reservierung läuft 10 Minuten'
);
select is(
  (select count(*)::int from app.notification_outbox where user_id = '00000000-0000-4000-8000-0000000000aa' and kind = 'waitlist_offer'),
  1,
  'Push für A liegt in der Outbox'
);
select is(
  (select array(select jsonb_object_keys(payload)) from app.notification_outbox where user_id = '00000000-0000-4000-8000-0000000000aa'),
  array['offerId'],
  'Push-Payload enthält nur die Angebots-ID (keine Praxis/Fachrichtung)'
);
select ok(
  exists (select 1 from realtime.messages where topic = 'offers:00000000-0000-4000-8000-0000000000aa'),
  'Realtime-Nachricht an A gesendet'
);
select throws_ok(
  $$ select app.book_slot('00000000-0000-4000-8000-0000000000bb', (select slot_id from t), 'b-sneak-1', null, null, 'Bea B', '0661 222222', 'public', '2026-10-01') $$,
  'P0001', 'slot_taken', 'B kann den für A reservierten Slot nicht buchen'
);

-- 11 Minuten später: Angebot abgelaufen → B rückt nach
select set_config('app.now', (now() + interval '11 minutes')::text, true);
select is(app.expire_holds_and_offers(), 1, 'Ein Angebot ist abgelaufen');
select is(
  (select status::text from public.waitlist_offers where user_id = '00000000-0000-4000-8000-0000000000aa'),
  'expired',
  'Angebot an A ist abgelaufen'
);
select is(
  (select user_id from public.waitlist_offers where slot_id = (select slot_id from t) and status = 'pending'),
  '00000000-0000-4000-8000-0000000000bb'::uuid,
  'Nächste Person (B) bekommt das Angebot'
);
select throws_ok(
  $$ select app.respond_offer('00000000-0000-4000-8000-0000000000aa',
       (select id from public.waitlist_offers where user_id = '00000000-0000-4000-8000-0000000000aa'),
       true, 'a-late-1', null, null, 'Anna A', '0661 333333', 'public', '2026-10-01') $$,
  'P0001', 'offer_expired', 'A kann das abgelaufene Angebot nicht mehr annehmen'
);

-- B nimmt an
select is(
  app.respond_offer('00000000-0000-4000-8000-0000000000bb',
    (select id from public.waitlist_offers where user_id = '00000000-0000-4000-8000-0000000000bb' and status = 'pending'),
    true, 'b-accept-1', null, 'follow_up', 'Bea B', '0661 222222', 'public', '2026-10-01') ->> 'status',
  'confirmed',
  'B bucht über das Angebot'
);
select is(
  (select status::text from public.waitlist_entries where user_id = '00000000-0000-4000-8000-0000000000bb'),
  'fulfilled',
  'Wartelisteneintrag von B ist erfüllt'
);

-- Termin-Alarm „nächste 24 Stunden“ (p_days = 1); andere Zeiträume bleiben ungültig
create temp table alarm24 as
  select app.join_waitlist('00000000-0000-4000-8000-0000000000cc', null, null, 1::smallint, 50.5558, 9.6808, 1, 10) as id;
select ok(
  (select upper(w.time_window) - lower(w.time_window) = interval '1 day'
     from public.waitlist_entries w join alarm24 a on a.id = w.id),
  'Termin-Alarm für die nächsten 24 Stunden'
);
select throws_ok(
  $$ select app.join_waitlist('00000000-0000-4000-8000-0000000000cc', null, null, 1::smallint, 50.5558, 9.6808, 2, 10) $$,
  'P0001', null, 'Zeitraum 2 Tage ist ungültig'
);

select * from finish();
rollback;
