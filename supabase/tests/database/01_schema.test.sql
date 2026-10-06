begin;
select plan(14);

select has_table('public', 'practices', 'Tabelle practices existiert');
select has_table('public', 'availability_slots', 'Tabelle availability_slots existiert');
select has_table('public', 'appointments', 'Tabelle appointments existiert');
select has_table('public', 'waitlist_offers', 'Tabelle waitlist_offers existiert');

select is(
  (select count(*)::int from pg_tables t join pg_class c on c.relname = t.tablename
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.schemaname
   where t.schemaname = 'public' and not c.relrowsecurity and t.tablename not in ('spatial_ref_sys')),
  0,
  'RLS ist auf allen öffentlichen Tabellen aktiv'
);

select is((select count(*)::int from public.specialties), 12, '12 Fachrichtungen');
select is((select count(*)::int from public.practices where is_demo), 60, '60 Demo-Praxen');
select ok((select bool_and(source = 'seed' and source_license <> '') from public.practices), 'Quelle und Lizenz je Praxis gesetzt');
select ok(
  (select max(starts_at) from public.availability_slots) > app.now() + interval '12 days',
  'Slots reichen ~14 Tage in die Zukunft'
);
select ok(
  (select count(*) from public.availability_slots where status = 'open') > 100,
  'Es gibt offene Slots'
);

-- Exclusion-Constraint: keine Überschneidung pro Arzt
select throws_ok(
  $$ insert into public.availability_slots (doctor_id, practice_id, starts_at, ends_at, source)
     select doctor_id, practice_id, starts_at + interval '5 minutes', ends_at + interval '5 minutes', 'seed'
     from public.availability_slots where status <> 'cancelled' limit 1 $$,
  '23P01',
  null,
  'Überlappender Slot desselben Arztes wird abgelehnt'
);

-- Stornierte Slots blockieren nicht
select lives_ok(
  $$ with s as (select * from public.availability_slots where status = 'open' limit 1)
     update public.availability_slots set status = 'cancelled' from s where availability_slots.id = s.id $$,
  'Slot kann storniert werden'
);

select is(
  (select geohash5 from public.practices limit 1) ~ '^[0-9b-hjkmnp-z]{5}$',
  true,
  'Geohash-5 wird generiert'
);

select col_not_null('public', 'appointments', 'idempotency_key', 'Idempotenz-Schlüssel ist Pflicht');

select * from finish();
rollback;
