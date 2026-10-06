begin;
select plan(11);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.org', false),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.org', false);
select app.grant_consent('00000000-0000-4000-8000-00000000000a', 'health_data', '2026-10-01');

-- Termin für A anlegen (wie die Edge Function, als service_role-Funktion)
select app.book_slot(
  '00000000-0000-4000-8000-00000000000a',
  (select id from public.availability_slots where status = 'open' and starts_at > app.now() order by starts_at limit 1),
  'rls-test-key-1', null, 'checkup', 'Alex Beispiel', '0661 123456', 'public', '2026-10-01'
);

-- anon: Verzeichnis lesbar, aber nicht schreibbar ------------------------------
set local role anon;
select ok((select count(*) from public.practices) = 60, 'anon liest Praxen');
select ok((select count(*) from public.availability_slots) > 0, 'anon liest Slots');
select throws_ok($$ select held_by from public.availability_slots limit 1 $$, '42501', null, 'held_by ist für anon nicht lesbar');
select throws_ok(
  $$ insert into public.practices (name, address, geo, source, source_license)
     values ('X', '{"street":"a","postal_code":"1","city":"c"}', 'SRID=4326;POINT(9 50)', 'seed', 'x') $$,
  '42501', null, 'anon kann keine Praxen anlegen'
);
select is((select count(*)::int from public.appointments), 0, 'anon sieht keine Termine');
reset role;

-- B sieht A's Termin nicht ------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
select is((select count(*)::int from public.appointments), 0, 'B sieht keine fremden Termine');
select is((select count(*)::int from public.booking_contacts), 0, 'B sieht keine fremden Kontaktdaten');
select throws_ok(
  $$ update public.availability_slots set status = 'booked' where status = 'open' $$,
  '42501', null, 'Clients können Slots nicht direkt ändern'
);
select throws_ok(
  $$ select app.book_slot('00000000-0000-4000-8000-00000000000b', gen_random_uuid(), 'xxxxxxxxxx', null, null, 'B', '0661 1', 'public', 'v') $$,
  '42501', null, 'Clients können book_slot nicht direkt aufrufen (nur Edge Function)'
);

-- A sieht den eigenen Termin, entschlüsselt -----------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
select is((select count(*)::int from public.appointments), 1, 'A sieht den eigenen Termin');
select is(
  (select public.get_my_appointments() -> 0 ->> 'reasonCategory'),
  'checkup',
  'Anlass wird nur für A entschlüsselt geliefert'
);
reset role;

select * from finish();
rollback;
