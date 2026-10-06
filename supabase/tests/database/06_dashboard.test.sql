begin;
select plan(31);

-- Feste Uhr: Dienstag, 6.10.2026, 12:00 Berlin (CEST). Wochenvorlagen über die
-- Zeitumstellung am 25.10.2026 werden unten geprüft.
select set_config('app.now', '2026-10-06 10:00:00+00', true);

-- Testpraxis (keine Demo-Slots) mit einer Ärztin; zweite Praxis für Fremdzugriffe.
insert into public.practices (id, name, address, geo, source, source_license, offers_video) values
  ('00000000-0000-4000-8000-00000000d001', 'Testpraxis Dashboard',
   '{"street": "Teststraße 1", "postal_code": "36037", "city": "Fulda"}',
   'SRID=4326;POINT(9.6808 50.5558)', 'practice_dashboard', 'Test', true),
  ('00000000-0000-4000-8000-00000000d002', 'Andere Testpraxis',
   '{"street": "Teststraße 2", "postal_code": "36037", "city": "Fulda"}',
   'SRID=4326;POINT(9.6900 50.5600)', 'practice_dashboard', 'Test', false);
insert into public.doctors (id, practice_id, name, specialty_ids) values
  ('00000000-0000-4000-8000-00000000d0d1', '00000000-0000-4000-8000-00000000d001', 'Dr. Test Eins', '{1}'),
  ('00000000-0000-4000-8000-00000000d0d2', '00000000-0000-4000-8000-00000000d002', 'Dr. Test Zwei', '{1}');

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-00000000e001', 'praxis@example.org', false),
  ('00000000-0000-4000-8000-00000000e002', 'fremd@example.org', false),
  ('00000000-0000-4000-8000-00000000e003', 'patientin@example.org', false);
select app.add_practice_member('00000000-0000-4000-8000-00000000d001', 'PRAXIS@example.org', 'owner');
select app.grant_consent('00000000-0000-4000-8000-00000000e003', 'health_data', '2026-10-01');

select isnt((select verified_at from public.practices where id = '00000000-0000-4000-8000-00000000d001'), null,
  'Mitglied hinzufügen markiert die Praxis als verifiziert');

-- Rechte
select ok(not has_function_privilege('anon', 'public.dashboard_week(uuid, timestamptz, timestamptz)', 'execute'),
  'anon darf Dashboard-Funktionen nicht ausführen');
select ok(not has_function_privilege('authenticated', 'app.add_practice_member(uuid, text, public.practice_role)', 'execute'),
  'Mitglieder anlegen nur über service_role');
select ok(not has_table_privilege('authenticated', 'public.availability_slots', 'insert'),
  'Keine direkten Slot-Schreibrechte für Clients');

-- Fremde Person (aal2), kein Mitglied
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000e002", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$ select public.dashboard_week('00000000-0000-4000-8000-00000000d001', app.now(), app.now() + interval '7 days') $$,
  'P0001', 'forbidden', 'Nicht-Mitglieder sehen die Praxis nicht'
);
select is((select count(*)::int from public.practice_members), 0, 'Fremde Mitgliedschaften sind per RLS unsichtbar');
select is(public.dashboard_my_practices(), '[]'::jsonb, 'Ohne Mitgliedschaft keine Praxen');

-- Mitglied ohne zweiten Faktor
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000e001", "role": "authenticated", "aal": "aal1"}';
select throws_ok(
  $$ select public.dashboard_week('00000000-0000-4000-8000-00000000d001', app.now(), app.now() + interval '7 days') $$,
  'P0001', 'mfa_required', 'Ohne Zwei-Faktor-Anmeldung kein Zugriff'
);

-- Mitglied mit zweitem Faktor
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000e001", "role": "authenticated", "aal": "aal2"}';
select is(public.dashboard_my_practices() -> 0 ->> 'role', 'owner', 'Mitglied sieht eigene Praxis mit Rolle');
select is(
  jsonb_array_length(public.dashboard_week('00000000-0000-4000-8000-00000000d001', app.now(), app.now() + interval '7 days') -> 'doctors'),
  1, 'Wochenansicht liefert die Ärztinnen und Ärzte'
);
select throws_ok(
  $$ select public.dashboard_week('00000000-0000-4000-8000-00000000d001', app.now(), app.now() + interval '40 days') $$,
  'P0001', 'invalid_input', 'Zeitraum ist begrenzt'
);

-- Einzelnen Slot anlegen (Mi 7.10., 09:00 Berlin = 07:00 UTC)
select is(
  public.dashboard_create_slot('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d0d1',
    '2026-10-07 07:00:00+00', 15, 'in_person') ->> 'status',
  'open', 'Neuer Slot ist frei'
);
select is(
  (select source::text from public.availability_slots where doctor_id = '00000000-0000-4000-8000-00000000d0d1' and starts_at = '2026-10-07 07:00:00+00'),
  'practice_dashboard', 'Quelle ist das Praxis-Dashboard'
);
select is(
  (public.dashboard_week('00000000-0000-4000-8000-00000000d001', app.now(), app.now() + interval '7 days') ->> 'lastSyncedAt')::timestamptz,
  app.now(), 'Änderung aktualisiert „Aktualisiert vor X Min.“'
);
select throws_ok(
  $$ select public.dashboard_create_slot('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d0d1',
       '2026-10-07 07:10:00+00', 15, 'in_person') $$,
  'P0001', 'slot_overlap', 'Überlappende Slots derselben Ärztin sind ausgeschlossen'
);
select throws_ok(
  $$ select public.dashboard_create_slot('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d0d1',
       '2026-10-05 07:00:00+00', 15, 'in_person') $$,
  'P0001', 'invalid_input', 'Slots in der Vergangenheit sind nicht möglich'
);
select throws_ok(
  $$ select public.dashboard_create_slot('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d0d2',
       '2026-10-07 08:00:00+00', 15, 'in_person') $$,
  'P0001', 'invalid_input', 'Ärztinnen/Ärzte anderer Praxen sind nicht wählbar'
);
select throws_ok(
  $$ select public.dashboard_create_slot('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000d0d2',
       '2026-10-07 08:00:00+00', 15, 'in_person') $$,
  'P0001', 'forbidden', 'Keine Slots für fremde Praxen'
);

-- Patientin bucht (wie die Edge Function als service_role)
reset role;
create temp table t_appt as
  select (app.book_slot('00000000-0000-4000-8000-00000000e003',
    (select id from public.availability_slots where doctor_id = '00000000-0000-4000-8000-00000000d0d1' and starts_at = '2026-10-07 07:00:00+00'),
    'dash-key-0001', null, 'checkup', 'Mara Beispiel', '069 90009 900', 'public', '2026-10-01') ->> 'id')::uuid as id;
grant select on t_appt to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000e001", "role": "authenticated", "aal": "aal2"}';

select is(
  public.dashboard_bookings('00000000-0000-4000-8000-00000000d001', app.now(), app.now() + interval '7 days') -> 0 -> 'contact' ->> 'fullName',
  'Mara Beispiel', 'Praxis sieht entschlüsselte Kontaktdaten der eigenen Buchungen'
);
select is(
  public.dashboard_week('00000000-0000-4000-8000-00000000d001', app.now(), app.now() + interval '7 days') -> 'slots' -> 0 ->> 'appointmentId',
  (select id::text from t_appt), 'Wochenansicht kennzeichnet über MedNow gebuchte Slots (ohne Personendaten)'
);
select throws_ok(
  $$ select public.dashboard_cancel_slot('00000000-0000-4000-8000-00000000d001',
       (select id from public.availability_slots where doctor_id = '00000000-0000-4000-8000-00000000d0d1' and starts_at = '2026-10-07 07:00:00+00')) $$,
  'P0001', 'slot_booked', 'Gebuchte Slots lassen sich nicht einfach entfernen'
);

-- Praxis sagt den Termin ab
select lives_ok(
  $$ select public.dashboard_cancel_appointment('00000000-0000-4000-8000-00000000d001', (select id from t_appt)) $$,
  'Praxis kann einen Termin absagen'
);
select is(
  public.dashboard_bookings('00000000-0000-4000-8000-00000000d001', app.now(), app.now() + interval '7 days') -> 0 -> 'contact',
  'null'::jsonb, 'Abgesagte Termine zeigen keine Kontaktdaten mehr'
);
reset role;
select is(
  (select payload from app.notification_outbox where kind = 'appointment_cancelled_by_practice'),
  jsonb_build_object('appointmentId', (select id from t_appt)),
  'Push-Outbox enthält nur die Termin-ID (keine Praxis, kein Arzt)'
);
select is(
  (select count(*)::int from app.practice_audit_log where practice_id = '00000000-0000-4000-8000-00000000d001' and action = 'view_bookings'),
  2, 'Jeder Abruf von Patientendaten wird protokolliert'
);

-- Neuer Slot geht an die Warteliste (gleiche Praxis)
select app.join_waitlist('00000000-0000-4000-8000-00000000e003', '00000000-0000-4000-8000-00000000d001', null, null, null, null, 7, 10);
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000e001", "role": "authenticated", "aal": "aal2"}';
select is(
  public.dashboard_create_slot('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d0d1',
    '2026-10-08 07:00:00+00', 20, 'in_person') ->> 'holdReason',
  'waitlist_offer', 'Neuer Slot aus dem Dashboard wird sofort der Warteliste angeboten'
);

-- Wochenvorlage: montags 09:00–10:00 Berlin, 20-Minuten-Slots
select is(
  public.dashboard_add_template('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d0d1',
    1, '09:00', '10:00', 20, 'in_person') ->> 'startTime',
  '09:00', 'Vorlage anlegen'
);
select throws_ok(
  $$ select public.dashboard_add_template('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d0d1',
       1, '09:30', '11:00', 15, 'in_person') $$,
  'P0001', 'template_overlap', 'Überlappende Vorlagen sind ausgeschlossen'
);
-- Mo 19.10. (CEST) und Mo 26.10. (CET, nach der Zeitumstellung)
select is(
  public.dashboard_apply_templates('00000000-0000-4000-8000-00000000d001', '2026-10-19', 2),
  6, 'Zwei Wochen × drei Slots'
);
select is(
  array(select to_char(starts_at at time zone 'UTC', 'MM-DD HH24:MI') from public.availability_slots
        where doctor_id = '00000000-0000-4000-8000-00000000d0d1' and starts_at >= '2026-10-19' and starts_at < '2026-10-28'
          and extract(minute from starts_at) = 0
        order by starts_at),
  array['10-19 07:00', '10-26 08:00'],
  '09:00 Berliner Zeit bleibt 09:00 – vor (UTC+2) und nach (UTC+1) der Zeitumstellung'
);
select is(
  public.dashboard_apply_templates('00000000-0000-4000-8000-00000000d001', '2026-10-19', 2),
  0, 'Erneutes Anwenden legt keine doppelten Slots an'
);

reset role;
select * from finish();
rollback;
