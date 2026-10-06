begin;
select plan(14);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000a1', 'a@example.org', false),
  ('00000000-0000-4000-8000-0000000000b1', 'b@example.org', false);
select app.grant_consent('00000000-0000-4000-8000-0000000000a1', 'health_data', '2026-10-01');
select app.grant_consent('00000000-0000-4000-8000-0000000000b1', 'health_data', '2026-10-01');

create temp table t_slot as
  select id from public.availability_slots
  where status = 'open' and starts_at > app.now() + interval '1 hour' order by starts_at limit 1;

-- Ohne Einwilligung keine Buchung
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000c1', 'c@example.org');
select throws_ok(
  $$ select app.book_slot('00000000-0000-4000-8000-0000000000c1', (select id from t_slot), 'key-consent-1', null, null, 'Cem C', '0661 123456', 'public', '2026-10-01') $$,
  'P0001', 'consent_missing', 'Ohne Art.-9-Einwilligung keine Buchung'
);

-- Halten: 5 Minuten
select is(
  (app.hold_slot('00000000-0000-4000-8000-0000000000a1', (select id from t_slot)) ->> 'heldUntil')::timestamptz - app.now(),
  interval '5 minutes',
  'Checkout-Hold läuft 5 Minuten'
);
select throws_ok(
  $$ select app.hold_slot('00000000-0000-4000-8000-0000000000b1', (select id from t_slot)) $$,
  'P0001', 'slot_taken', 'Gehaltener Slot kann nicht von anderen gehalten werden'
);
select throws_ok(
  $$ select app.book_slot('00000000-0000-4000-8000-0000000000b1', (select id from t_slot), 'key-b-0001', null, null, 'Bea B', '0661 123456', 'public', '2026-10-01') $$,
  'P0001', 'slot_taken', 'Gehaltener Slot kann nicht von anderen gebucht werden'
);

-- A bucht
select is(
  (app.book_slot('00000000-0000-4000-8000-0000000000a1', (select id from t_slot), 'key-a-0001', null, 'acute', 'Alex Beispiel', '0661 123456', 'public', '2026-10-01') ->> 'status'),
  'confirmed',
  'A bucht den gehaltenen Slot'
);
select is((select status::text from public.availability_slots where id = (select id from t_slot)), 'booked', 'Slot ist gebucht');

-- Idempotenz: gleicher Schlüssel → gleicher Termin
select is(
  (select count(*)::int from public.appointments where user_id = '00000000-0000-4000-8000-0000000000a1'),
  1, 'Ein Termin für A'
);
select is(
  app.book_slot('00000000-0000-4000-8000-0000000000a1', (select id from t_slot), 'key-a-0001', null, 'acute', 'Alex Beispiel', '0661 123456', 'public', '2026-10-01') ->> 'id',
  (select id::text from public.appointments where user_id = '00000000-0000-4000-8000-0000000000a1'),
  'Wiederholung mit gleichem Idempotenz-Schlüssel liefert denselben Termin'
);

-- Doppelbuchung unmöglich
select throws_ok(
  $$ select app.book_slot('00000000-0000-4000-8000-0000000000b1', (select id from t_slot), 'key-b-0002', null, null, 'Bea B', '0661 123456', 'public', '2026-10-01') $$,
  'P0001', 'slot_taken', 'Zweite Buchung desselben Slots schlägt fehl'
);
select throws_ok(
  $$ insert into public.appointments (user_id, slot_id, practice_id, doctor_id, starts_at, ends_at, visit_type, idempotency_key)
     select '00000000-0000-4000-8000-0000000000b1', s.id, s.practice_id, s.doctor_id, s.starts_at, s.ends_at, s.visit_type, 'direct-insert-1'
     from public.availability_slots s where s.id = (select id from t_slot) $$,
  '23505', null, 'Unique-Index verhindert zweite aktive Buchung auch bei direktem Insert'
);

-- Kontaktdaten verschlüsselt gespeichert
select ok(
  (select position('Alex' in encode(full_name_enc, 'escape')) = 0 from public.booking_contacts limit 1),
  'Name liegt nur verschlüsselt in der Datenbank'
);

-- Storno gibt Slot frei
select lives_ok(
  $$ select app.cancel_appointment('00000000-0000-4000-8000-0000000000a1',
       (select id from public.appointments where user_id = '00000000-0000-4000-8000-0000000000a1')) $$,
  'A storniert'
);
select is((select status::text from public.availability_slots where id = (select id from t_slot)), 'open', 'Slot ist nach Storno wieder offen');
select is(
  (app.book_slot('00000000-0000-4000-8000-0000000000b1', (select id from t_slot), 'key-b-0003', null, null, 'Bea Beispiel', '0661 654321', 'private', '2026-10-01') ->> 'status'),
  'confirmed',
  'Nach Storno kann B den Slot buchen'
);

select * from finish();
rollback;
