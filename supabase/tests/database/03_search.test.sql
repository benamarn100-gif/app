begin;
select plan(12);

-- Zeitfenster in Berliner Zeit inkl. Sommerzeit
select is(
  (select w_to from app.window_bounds('today', '2026-07-14 23:30:00+00')),
  '2026-07-15 21:59:59.999999+00'::timestamptz,
  'today endet um Mitternacht Berlin (Sommerzeit)'
);
select is(
  (select w_from from app.window_bounds('tomorrow', '2026-10-24 10:00:00+00')),
  '2026-10-24 22:00:00+00'::timestamptz,
  'tomorrow beginnt am Tag der Zeitumstellung um 00:00 Berlin (UTC+2)'
);
select is(
  (select w_to from app.window_bounds('tomorrow', '2026-10-24 10:00:00+00')),
  '2026-10-25 22:59:59.999999+00'::timestamptz,
  'Der 25.10.2026 hat 25 Stunden'
);

select is(
  (select w_to from app.window_bounds('next24h', '2026-10-06 18:30:00+00')),
  '2026-10-07 18:30:00+00'::timestamptz,
  'next24h reicht am Abend bis in den nächsten Tag'
);
select ok(
  (select count(*) from public.search_availability(50.5558, 9.6808, 15, 'next24h') where open_count > 0)
    >= (select count(*) from public.search_availability(50.5558, 9.6808, 15, 'today') where open_count > 0),
  'next24h findet mindestens so viele freie Praxen wie today'
);

-- Suche rund um Fulda
create temp table r as
  select * from public.search_availability(50.5558, 9.6808, 10, 'week');

select ok((select count(*) from r) > 30, 'Suche liefert Praxen im Umkreis');
select ok((select bool_and(distance_m <= 10000) from r), 'Alle Treffer im Radius');
select ok((select count(distinct status) from r) >= 3, 'Verschiedene Status (frei/wenige/ausgebucht/unbekannt)');
select ok(
  (select bool_and(case when open_count >= 3 then status = 'free' when open_count >= 1 then status = 'few' else status in ('booked', 'unknown') end) from r),
  'Statusregel: ≥3 frei, 1–2 wenige, 0 ausgebucht'
);
select ok(
  (select bool_and(next_slot is null and open_count = 0) from r where status = 'unknown'),
  'Unbekannt: keine Zusage (kein nächster Slot)'
);

-- Veraltete Daten (> 24 h) → unknown
update public.availability_sources set last_synced_at = app.now() - interval '25 hours'
 where practice_id = (select (practice ->> 'id')::uuid from r where status = 'free' limit 1);
select is(
  (select status from public.search_availability(50.5558, 9.6808, 10, 'week') s
    where (s.practice ->> 'id')::uuid = (select (practice ->> 'id')::uuid from r where status = 'free' limit 1)),
  'unknown',
  'Daten älter als 24 h ergeben „unknown“'
);

-- Fachrichtungsfilter
select ok(
  (select bool_and((practice -> 'specialtyIds') @> '[3]') from public.search_availability(50.5558, 9.6808, 25, 'week', array[3]::smallint[])),
  'Filter Fachrichtung'
);

select * from finish();
rollback;
