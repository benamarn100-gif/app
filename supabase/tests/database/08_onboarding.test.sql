begin;
select plan(16);

select set_config('app.now', '2026-10-07 10:00:00+00', true);

-- Rechte: nur der Betreiber
select ok(not has_function_privilege('anon', 'app.onboard_practice(jsonb)', 'execute'), 'anon darf keine Praxen anlegen');
select ok(not has_function_privilege('authenticated', 'app.onboard_practice(jsonb)', 'execute'), 'Nutzer dürfen keine Praxen anlegen');
select ok(not has_table_privilege('authenticated', 'app.practice_invites', 'select'), 'Einladungen sind nicht lesbar');

-- Probelauf legt nichts an
select is((app.onboard_practice('{"dry_run": true, "name": "Pilotpraxis Probe", "street": "Am Markt 1", "postal_code": "60311",
  "city": "Frankfurt am Main", "lat": 50.11, "lng": 8.68, "specialties": ["allgemeinmedizin"], "doctors": ["Dr. Probe"],
  "owner_email": "probe@example.org"}') ->> 'dryRun'), 'true', 'Probelauf meldet dryRun');
select is((select count(*)::int from public.practices where name = 'Pilotpraxis Probe'), 0, 'Probelauf legt nichts an');

-- Neue Praxis, Praxis-E-Mail hat noch kein Konto → Einladung
create temp table onboarded as
select app.onboard_practice('{"name": "Hausarztpraxis Pilot", "street": "Am Markt 1", "postal_code": "60311",
  "city": "Frankfurt am Main", "lat": 50.1106, "lng": 8.6821, "phone": "069 000000", "website": "https://example.org",
  "specialties": ["allgemeinmedizin", "innere-medizin"], "doctors": ["Dr. med. A. Beispiel", "B. Muster"],
  "languages": ["de", "en"], "owner_email": "Pilot@Example.org"}') as r;

select is((select r ->> 'owner' from onboarded), 'invited', 'Ohne Konto: Einladung');
select results_eq(
  $$select is_demo, source::text, specialty_ids, languages from public.practices where id = (select (r ->> 'practiceId')::uuid from onboarded)$$,
  $$values (false, 'practice_dashboard', '{1,2}'::smallint[], '{de,en}'::text[])$$,
  'Echte Praxis: keine Demo, Quelle Praxisangaben, Fachrichtungen und Sprachen');
select is((select count(*)::int from public.doctors where practice_id = (select (r ->> 'practiceId')::uuid from onboarded)), 2,
  'Beide Ärzte angelegt');
select is((select verified_at from public.practices where id = (select (r ->> 'practiceId')::uuid from onboarded)), null,
  'Noch nicht verifiziert, solange niemand Zugang hat');

-- Anmeldung ohne bestätigte Adresse → noch kein Zugang
insert into auth.users (id, email, is_anonymous) values ('00000000-0000-4000-8000-0000000f0001', 'pilot@example.org', false);
select is((select count(*)::int from public.practice_members where user_id = '00000000-0000-4000-8000-0000000f0001'), 0,
  'Unbestätigte Adresse bekommt keinen Zugang');

-- Adresse bestätigt (Code eingegeben) → Mitglied als owner, Praxis verifiziert
update auth.users set email_confirmed_at = now() where id = '00000000-0000-4000-8000-0000000f0001';
select is((select role::text from public.practice_members where user_id = '00000000-0000-4000-8000-0000000f0001'), 'owner',
  'Nach Bestätigung: Inhaberin/Inhaber der Praxis');
select isnt((select verified_at from public.practices where id = (select (r ->> 'practiceId')::uuid from onboarded)), null,
  'Praxis gilt jetzt als verifiziert');

-- Bestehendes Konto → sofort Mitglied
insert into auth.users (id, email, is_anonymous, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000f0002', 'zweite@example.org', false, now());
select is((app.onboard_practice('{"name": "Kinderarztpraxis Pilot", "street": "Am Markt 2", "postal_code": "60311",
  "city": "Frankfurt am Main", "lat": 50.11, "lng": 8.68, "specialties": ["kinder-jugendmedizin"], "doctors": ["Dr. C. Test"],
  "owner_email": "zweite@example.org"}') ->> 'owner'), 'member', 'Bestehendes Konto wird sofort Mitglied');

-- Fehler
select throws_like($$select app.onboard_practice('{"name": "Hausarztpraxis Pilot", "street": "Am Markt 1", "postal_code": "60311",
  "city": "Frankfurt am Main", "lat": 50.11, "lng": 8.68, "specialties": ["allgemeinmedizin"], "doctors": ["Dr. X"],
  "owner_email": "x@example.org"}')$$, 'practice_exists%', 'Doppelte Praxis wird abgelehnt');
select throws_like($$select app.onboard_practice('{"name": "Praxis Z", "street": "Weg 1", "postal_code": "60311",
  "city": "Frankfurt", "lat": 50.11, "lng": 8.68, "specialties": ["kardiologie"], "doctors": ["Dr. Z"],
  "owner_email": "z@example.org"}')$$, '%unbekannte Fachrichtung%kardiologie%', 'Unbekannte Fachrichtung wird genannt');
select throws_like($$select app.onboard_practice('{"name": "Praxis Y", "street": "Weg 1", "postal_code": "60311",
  "city": "Frankfurt", "lat": 8.68, "lng": 50.11, "specialties": ["hno"], "doctors": ["Dr. Y"],
  "owner_email": "y@example.org"}')$$, '%Koordinaten%', 'Vertauschte Koordinaten werden erkannt');

select * from finish();
rollback;
