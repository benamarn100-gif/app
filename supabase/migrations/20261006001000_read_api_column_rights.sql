-- MedNow · Lese-API ohne ganze Slot-Zeilen.
-- anon/authenticated dürfen nur einzelne Spalten von availability_slots lesen (held_by und
-- external_ref sind gesperrt, Migration 0200). Funktionen mit Aufruferrechten, die eine ganze
-- Zeile übergeben (app.slot_json(s), app.is_bookable(s, …)), scheitern deshalb auf dem Server mit
-- 42501. Die Hilfsfunktionen nehmen jetzt einzelne Spalten; die Zeilen-Varianten bleiben für die
-- security-definer-Funktionen (Buchung, Warteliste, Realtime) und delegieren.

create or replace function app.slot_bookable(
  p_starts_at timestamptz,
  p_status public.slot_status,
  p_hold_reason public.hold_reason,
  p_held_until timestamptz,
  p_now timestamptz
) returns boolean
language sql immutable
set search_path = ''
as $$
  select p_starts_at > p_now
     and (p_status = 'open' or (p_status = 'held' and p_hold_reason = 'checkout' and p_held_until <= p_now))
$$;

create or replace function app.slot_public_json(
  p_id uuid,
  p_doctor_id uuid,
  p_practice_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_status public.slot_status,
  p_held_until timestamptz,
  p_hold_reason public.hold_reason,
  p_visit_type public.visit_type,
  p_updated_at timestamptz
) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_id, 'doctorId', p_doctor_id, 'practiceId', p_practice_id,
    'startsAt', p_starts_at, 'endsAt', p_ends_at, 'status', p_status,
    'heldUntil', p_held_until, 'holdReason', p_hold_reason, 'visitType', p_visit_type,
    'updatedAt', p_updated_at
  )
$$;

grant execute on function
  app.slot_bookable(timestamptz, public.slot_status, public.hold_reason, timestamptz, timestamptz),
  app.slot_public_json(uuid, uuid, uuid, timestamptz, timestamptz, public.slot_status, timestamptz, public.hold_reason, public.visit_type, timestamptz)
  to anon, authenticated, service_role;

-- Zeilen-Varianten: eine Regel, ein JSON-Format
create or replace function app.is_bookable(s public.availability_slots, p_now timestamptz) returns boolean
language sql stable
set search_path = public
as $$
  select app.slot_bookable(s.starts_at, s.status, s.hold_reason, s.held_until, p_now)
$$;

create or replace function app.slot_json(s public.availability_slots) returns jsonb
language sql stable
set search_path = public
as $$
  select app.slot_public_json(s.id, s.doctor_id, s.practice_id, s.starts_at, s.ends_at, s.status,
                              s.held_until, s.hold_reason, s.visit_type, s.updated_at)
$$;

-- Suche: unverändert bis auf die Spaltenzugriffe
create or replace function public.search_availability(
  p_lat double precision,
  p_lng double precision,
  p_radius_km integer default 10,
  p_window text default 'week',
  p_specialty_ids smallint[] default '{}',
  p_languages text[] default '{}',
  p_accessibility text[] default '{}',
  p_insurance text default 'any',
  p_video_only boolean default false,
  p_text text default ''
)
returns table (
  practice jsonb,
  status text,
  open_count integer,
  next_slot jsonb,
  distance_m double precision,
  last_synced_at timestamptz
)
language sql stable
set search_path = public, extensions
as $$
  with params as (
    select app.now() as now,
           st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as center,
           least(greatest(coalesce(p_radius_km, 10), 1), 50) * 1000 as radius_m,
           nullif(trim(coalesce(p_text, '')), '') as q
  ),
  bounds as (select b.* from params, app.window_bounds(p_window, params.now) b),
  candidates as (
    select p.id, p.name, p as rec, st_distance(p.geo, params.center) as distance_m
    from public.practices p, params
    where st_dwithin(p.geo, params.center, params.radius_m)
      and (cardinality(p_specialty_ids) = 0 or p.specialty_ids && p_specialty_ids)
      and (cardinality(p_languages) = 0 or p.languages @> p_languages)
      and not exists (
        select 1 from unnest(p_accessibility) f where coalesce((p.accessibility ->> f)::boolean, false) = false
      )
      and (p_insurance <> 'public' or p.accepts_public)
      and (p_insurance <> 'private' or p.accepts_private)
      and (not p_video_only or p.offers_video)
      and (
        params.q is null
        or p.name ilike '%' || params.q || '%'
        or exists (
          select 1 from public.specialties s
          where s.id = any (p.specialty_ids)
            and (s.name_de ilike '%' || params.q || '%' or s.name_en ilike '%' || params.q || '%' or s.slug ilike '%' || params.q || '%')
        )
        or exists (select 1 from public.doctors d where d.practice_id = p.id and d.name ilike '%' || params.q || '%')
      )
  ),
  sync as (
    select src.practice_id, max(src.last_synced_at) as last_synced_at
    from public.availability_sources src
    join candidates c on c.id = src.practice_id
    group by src.practice_id
  ),
  open_slots as (
    select s.id, s.doctor_id, s.practice_id, s.starts_at, s.ends_at, s.status,
           s.held_until, s.hold_reason, s.visit_type, s.updated_at
    from public.availability_slots s
    join candidates c on c.id = s.practice_id
    cross join params
    cross join bounds
    where s.starts_at between bounds.w_from and bounds.w_to
      and app.slot_bookable(s.starts_at, s.status, s.hold_reason, s.held_until, params.now)
      and (not p_video_only or s.visit_type = 'video')
  ),
  slot_stats as (
    select distinct on (o.practice_id)
      o.practice_id,
      (count(*) over (partition by o.practice_id))::int as open_count,
      app.slot_public_json(o.id, o.doctor_id, o.practice_id, o.starts_at, o.ends_at, o.status,
                           o.held_until, o.hold_reason, o.visit_type, o.updated_at) as next_slot
    from open_slots o
    order by o.practice_id, o.starts_at
  ),
  scored as (
    select c.id, c.name, c.rec, c.distance_m, sy.last_synced_at as synced,
      (sy.last_synced_at is null or sy.last_synced_at < (select now from params) - interval '24 hours') as stale,
      coalesce(st.open_count, 0) as cnt, st.next_slot as nxt
    from candidates c
    left join sync sy on sy.practice_id = c.id
    left join slot_stats st on st.practice_id = c.id
  )
  select
    app.practice_json(sc.rec),
    case when sc.stale then 'unknown' when sc.cnt >= 3 then 'free' when sc.cnt >= 1 then 'few' else 'booked' end,
    case when sc.stale then 0 else sc.cnt end,
    case when sc.stale then null else sc.nxt end,
    sc.distance_m,
    sc.synced
  from scored sc
  order by
    case when sc.stale then 3 when sc.cnt >= 3 then 0 when sc.cnt >= 1 then 1 else 2 end,
    sc.distance_m,
    sc.name
  limit 300
$$;

create or replace function public.get_slots(p_practice_id uuid, p_from timestamptz, p_to timestamptz) returns setof jsonb
language sql stable
set search_path = public
as $$
  select app.slot_public_json(s.id, s.doctor_id, s.practice_id, s.starts_at, s.ends_at, s.status,
                              s.held_until, s.hold_reason, s.visit_type, s.updated_at)
  from public.availability_slots s
  where s.practice_id = p_practice_id
    and s.starts_at between p_from and least(p_to, p_from + interval '31 days')
    and s.status <> 'cancelled'
  order by s.starts_at
$$;
