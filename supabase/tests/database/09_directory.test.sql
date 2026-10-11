begin;
select plan(29);

select set_config('app.now', '2026-10-11 10:00:00+00', true);

-- Rechte: nur der Betreiber
select ok(not has_function_privilege('anon', 'app.import_osm_practices(jsonb, timestamptz)', 'execute'), 'anon darf nicht importieren');
select ok(not has_function_privilege('authenticated', 'app.import_osm_practices(jsonb, timestamptz)', 'execute'), 'Nutzer dürfen nicht importieren');
select ok(not has_function_privilege('authenticated', 'app.exclude_directory_entry(text, text)', 'execute'), 'Nutzer dürfen nichts ausschließen');
select ok(not has_table_privilege('authenticated', 'app.settings', 'update'), 'Nutzer können den Demo-Schalter nicht umlegen');

-- Demo ausgeschaltet: unsichtbar und nicht buchbar --------------------------------
create temp table demo_slot as
  select s.id, s.practice_id from public.availability_slots s
   where s.status = 'open' and s.starts_at > app.now() order by s.starts_at limit 1;
grant select on demo_slot to anon;
update app.settings set value = 'false' where key = 'show_demo';

set local role anon;
select is((select count(*)::int from public.practices where is_demo), 0, 'anon: keine Demo-Praxen');
select is((select count(*)::int from public.search_availability(50.5558, 9.6808, 25)), 0, 'Suche: keine Demo-Praxen');
select is(public.get_practice((select practice_id from demo_slot)), null, 'Demo-Praxis: nicht abrufbar');
select is((select count(*)::int from public.get_slots((select practice_id from demo_slot), app.now(), app.now() + interval '14 days')), 0,
  'Demo-Termine: nicht abrufbar');
select is((select count(*)::int from public.doctors), 0, 'Demo-Ärztinnen/-Ärzte: nicht abrufbar');
reset role;

insert into auth.users (id, email, is_anonymous) values ('00000000-0000-4000-8000-0000000d0001', 'd@example.org', false);
select throws_ok(
  format('select app.hold_slot(%L, %L)', '00000000-0000-4000-8000-0000000d0001', (select id from demo_slot)),
  'P0001', 'not_found', 'Demo-Termin kann nicht reserviert werden');
select is(app.demo_roll_slots(), 0, 'Demo-Job erzeugt nichts');

-- Import aus OpenStreetMap --------------------------------------------------------
create temp table imported as select app.import_osm_practices('[
  {"ref": "node/1001", "name": "Hausarztpraxis Dr. Beispiel", "street": "Bahnhofstraße 5", "postal_code": "36037",
   "city": "Fulda", "lat": 50.5541, "lng": 9.6810, "phone": "+49 661 1234", "website": "https://example.org",
   "specialties": ["allgemeinmedizin"], "wheelchair": true,
   "opening_hours": {"mon": [{"open": "08:00", "close": "12:00"}]}},
  {"ref": "way/2002", "name": "Zahnarztpraxis Muster", "street": "Am Markt 1", "postal_code": "36037",
   "city": "Fulda", "lat": 50.5520, "lng": 9.6790, "specialties": ["zahnmedizin"], "website": "example.org",
   "languages": ["en", "tr"], "private_only": true},
  {"ref": "node/3003", "name": "Ohne Fachrichtung", "street": "Weg 1", "postal_code": "36037", "city": "Fulda",
   "lat": 50.55, "lng": 9.68, "specialties": ["radiologie"]},
  {"ref": "node/4004", "name": "Ohne Postleitzahl", "street": "Weg 2", "postal_code": "", "city": "Fulda",
   "lat": 50.55, "lng": 9.68, "specialties": ["hno"]},
  {"ref": "node/5005", "name": "Vertauscht", "street": "Weg 3", "postal_code": "36037", "city": "Fulda",
   "lat": 9.68, "lng": 50.55, "specialties": ["hno"]},
  {"ref": "evil; drop table x", "name": "Kaputt", "street": "Weg 4", "postal_code": "36037", "city": "Fulda",
   "lat": 50.55, "lng": 9.68, "specialties": ["hno"]}
]') as r;

select is((select r from imported),
  '{"inserted": 2, "updated": 0, "invalid": 4, "excluded": 0, "maintainedByPractice": 0}'::jsonb,
  'Zwei gültige Praxen angelegt, ungültige übersprungen');
select results_eq(
  $$select is_demo, source::text, source_license, specialty_ids, accessibility, accepts_public, accepts_private, website
      from public.practices where external_ref = 'osm:node/1001'$$,
  $$values (false, 'osm', '© OpenStreetMap-Mitwirkende, ODbL 1.0', '{1}'::smallint[], '{"wheelchair": true}'::jsonb, true, true,
            'https://example.org'::text)$$,
  'Verzeichnis-Praxis: echt, Quelle und Lizenz, Barrierefreiheit nur wie angegeben');
select results_eq(
  $$select accepts_public, website, languages, accessibility from public.practices where external_ref = 'osm:way/2002'$$,
  $$values (false, null::text, '{de,en,tr}'::text[], '{}'::jsonb)$$,
  'Privatpraxis erkannt, Website ohne https verworfen, Deutsch immer dabei, keine erfundene Barrierefreiheit');
select is((select count(*)::int from public.doctors d join public.practices p on p.id = d.practice_id where p.source = 'osm'), 0,
  'Keine erfundenen Ärztinnen/Ärzte');

set local role anon;
select results_eq(
  $$select status, open_count, next_slot from public.search_availability(50.5558, 9.6808, 5)
     where practice ->> 'name' = 'Hausarztpraxis Dr. Beispiel'$$,
  $$values ('unknown'::text, 0, null::jsonb)$$,
  'Suche: Verzeichnis-Praxis ohne Termindaten ist „unbekannt“');
select is(
  (select public.get_practice(id) -> 'practice' ->> 'sourceUrl' from public.practices where name = 'Hausarztpraxis Dr. Beispiel'),
  'https://www.openstreetmap.org/node/1001', 'Link zum OpenStreetMap-Eintrag für Korrekturen');
reset role;

-- Erneuter Import aktualisiert statt zu verdoppeln
select is(app.import_osm_practices('[{"ref": "node/1001", "name": "Hausarztpraxis Dr. Beispiel", "street": "Bahnhofstraße 7",
  "postal_code": "36037", "city": "Fulda", "lat": 50.5541, "lng": 9.6810, "specialties": ["allgemeinmedizin", "innere-medizin"],
  "opening_hours": {"mon": [{"open": "08:00", "close": "12:00"}]}}]',
  '2026-10-11 11:00:00+00') ->> 'updated', '1', 'Zweiter Import aktualisiert');
select results_eq(
  $$select address ->> 'street', specialty_ids, phone from public.practices where external_ref = 'osm:node/1001'$$,
  $$values ('Bahnhofstraße 7'::text, '{1,2}'::smallint[], null::text)$$,
  'Neue Angaben übernommen');
select is((select count(*)::int from public.practices where external_ref = 'osm:node/1001'), 1, 'Kein Duplikat');

-- Pilotpraxis übernimmt den Verzeichniseintrag (gleiche Adresse, gleiche Fachrichtung)
create temp table claimed as select app.onboard_practice('{"name": "Praxis Dr. Beispiel", "street": "Bahnhofstr. 7",
  "postal_code": "36037", "city": "Fulda", "lat": 50.5542, "lng": 9.6811, "specialties": ["allgemeinmedizin"],
  "doctors": ["Dr. med. Beispiel"], "owner_email": "praxis-beispiel@example.org"}') as r;
select is((select (r ->> 'practiceId')::uuid from claimed), (select id from public.practices where external_ref = 'osm:node/1001'),
  'Pilot übernimmt die bestehende Praxis-ID');
select results_eq(
  $$select source::text, name, opening_hours from public.practices where external_ref = 'osm:node/1001'$$,
  $$values ('practice_dashboard'::text, 'Praxis Dr. Beispiel'::text, '{"mon": [{"open": "08:00", "close": "12:00"}]}'::jsonb)$$,
  'Jetzt von der Praxis gepflegt, Öffnungszeiten bleiben');

-- Gepflegte Praxen überschreibt der Import nicht
select is(app.import_osm_practices('[{"ref": "node/1001", "name": "Alter Name", "street": "Bahnhofstraße 7",
  "postal_code": "36037", "city": "Fulda", "lat": 50.5541, "lng": 9.6810, "specialties": ["allgemeinmedizin"]}]')
  ->> 'maintainedByPractice', '1', 'Import lässt gepflegte Praxis in Ruhe');
select is((select name from public.practices where external_ref = 'osm:node/1001'), 'Praxis Dr. Beispiel', 'Name unverändert');
-- … und legt sie auch unter anderem OSM-Objekt nicht doppelt an
select is(app.import_osm_practices('[{"ref": "node/1009", "name": "Praxis Dr. Beispiel", "street": "Bahnhofstraße 7",
  "postal_code": "36037", "city": "Fulda", "lat": 50.5541, "lng": 9.6810, "specialties": ["allgemeinmedizin"]}]')
  ->> 'maintainedByPractice', '1', 'Kein Duplikat einer gepflegten Praxis');

-- Ausschluss: Praxis will nicht ins Verzeichnis
select is(app.exclude_directory_entry('way/2002', 'Praxis hat um Löschung gebeten'), 1, 'Eintrag entfernt');
select is(app.import_osm_practices('[{"ref": "way/2002", "name": "Zahnarztpraxis Muster", "street": "Am Markt 1",
  "postal_code": "36037", "city": "Fulda", "lat": 50.5520, "lng": 9.6790, "specialties": ["zahnmedizin"]}]')
  ->> 'excluded', '1', 'Ausgeschlossener Eintrag kommt nicht wieder');

-- Aufräumen: Schutz vor unvollständigem Import
select app.import_osm_practices(jsonb_build_array(
  jsonb_build_object('ref', 'node/7001', 'name', 'Praxis Eins', 'street', 'Weg 10', 'postal_code', '36037', 'city', 'Fulda',
                     'lat', 50.56, 'lng', 9.69, 'specialties', jsonb_build_array('hno')),
  jsonb_build_object('ref', 'node/7002', 'name', 'Praxis Zwei', 'street', 'Weg 11', 'postal_code', '36037', 'city', 'Fulda',
                     'lat', 50.56, 'lng', 9.69, 'specialties', jsonb_build_array('hno'))), '2026-10-01 00:00:00+00');
select throws_ok($$ select app.prune_osm_practices('2026-10-05 00:00:00+00', 0.1) $$, 'P0001', null,
  'Aufräumen verweigert, wenn zu viele Einträge fehlen würden');
select is(app.prune_osm_practices('2026-10-05 00:00:00+00', 1), 2, 'Veraltete Einträge entfernt');

update app.settings set value = 'true' where key = 'show_demo';
select * from finish();
rollback;
