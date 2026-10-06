-- MedNow · Lese-API (RPC). JSON-Formen entsprechen den TypeScript-Domain-Typen
-- (src/domain/types.ts), damit die App ohne Umbenennungen arbeiten kann.

create or replace function app.practice_json(p public.practices) returns jsonb
language sql stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'address', jsonb_build_object('street', p.address->>'street', 'postalCode', p.address->>'postal_code', 'city', p.address->>'city'),
    'location', jsonb_build_object('lat', st_y(p.geo::geometry), 'lng', st_x(p.geo::geometry)),
    'phone', p.phone,
    'website', p.website,
    'languages', to_jsonb(p.languages),
    'accessibility', p.accessibility,
    'acceptsPublic', p.accepts_public,
    'acceptsPrivate', p.accepts_private,
    'offersVideo', p.offers_video,
    'openingHours', p.opening_hours,
    'services', to_jsonb(p.services),
    'photoUrl', p.photo_url,
    'photoBlurhash', p.photo_blurhash,
    'rating', case when p.rating_avg is null then null
                   else jsonb_build_object('average', p.rating_avg, 'count', p.rating_count) end,
    'specialtyIds', to_jsonb(p.specialty_ids),
    'isDemo', p.is_demo,
    'source', p.source,
    'sourceLicense', p.source_license,
    'verifiedAt', p.verified_at
  )
$$;

create or replace function app.doctor_json(d public.doctors) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', d.id, 'practiceId', d.practice_id, 'name', d.name,
    'specialtyIds', to_jsonb(d.specialty_ids), 'languages', to_jsonb(d.languages), 'photoUrl', d.photo_url
  )
$$;

-- Öffentliche Slot-Form – ohne held_by.
create or replace function app.slot_json(s public.availability_slots) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id, 'doctorId', s.doctor_id, 'practiceId', s.practice_id,
    'startsAt', s.starts_at, 'endsAt', s.ends_at, 'status', s.status,
    'heldUntil', s.held_until, 'holdReason', s.hold_reason, 'visitType', s.visit_type,
    'updatedAt', s.updated_at
  )
$$;

grant usage on schema app to anon, authenticated;
grant execute on function app.practice_json(public.practices), app.doctor_json(public.doctors), app.slot_json(public.availability_slots)
  to anon, authenticated, service_role;

-- Zeitfenster in Berliner Zeit (DST-sicher) --------------------------------------
create or replace function app.window_bounds(p_window text, p_now timestamptz, out w_from timestamptz, out w_to timestamptz)
language sql stable
set search_path = ''
as $$
  select
    case p_window when 'tomorrow'
      then (date_trunc('day', p_now at time zone 'Europe/Berlin') + interval '1 day') at time zone 'Europe/Berlin'
      else p_now end,
    case p_window
      when 'today' then (date_trunc('day', p_now at time zone 'Europe/Berlin') + interval '1 day') at time zone 'Europe/Berlin' - interval '1 microsecond'
      when 'tomorrow' then (date_trunc('day', p_now at time zone 'Europe/Berlin') + interval '2 days') at time zone 'Europe/Berlin' - interval '1 microsecond'
      else (date_trunc('day', p_now at time zone 'Europe/Berlin') + interval '7 days') at time zone 'Europe/Berlin' - interval '1 microsecond'
    end
$$;
grant execute on function app.window_bounds(text, timestamptz) to anon, authenticated, service_role;

-- Buchbar = offen, oder Checkout-Hold abgelaufen. Abgelaufene Wartelisten-Angebote
-- werden vom Job weitergereicht (Fairness: die nächste Person in der Liste zuerst).
create or replace function app.is_bookable(s public.availability_slots, p_now timestamptz) returns boolean
language sql stable
set search_path = public
as $$
  select s.starts_at > p_now
     and (s.status = 'open' or (s.status = 'held' and s.hold_reason = 'checkout' and s.held_until <= p_now))
$$;
grant execute on function app.is_bookable(public.availability_slots, timestamptz) to anon, authenticated, service_role;

-- Suche: ein Roundtrip liefert Status, offene Slots, nächsten Slot, Entfernung, Aktualität.
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
  slot_stats as (
    select c.id as practice_id, agg.open_count, nxt.slot as next_slot
    from candidates c
    cross join params
    cross join bounds
    left join lateral (
      select count(*)::int as open_count
      from public.availability_slots s
      where s.practice_id = c.id
        and s.starts_at between bounds.w_from and bounds.w_to
        and app.is_bookable(s, params.now)
        and (not p_video_only or s.visit_type = 'video')
    ) agg on true
    left join lateral (
      select app.slot_json(s) as slot
      from public.availability_slots s
      where s.practice_id = c.id
        and s.starts_at between bounds.w_from and bounds.w_to
        and app.is_bookable(s, params.now)
        and (not p_video_only or s.visit_type = 'video')
      order by s.starts_at
      limit 1
    ) nxt on true
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
grant execute on function public.search_availability(double precision, double precision, integer, text, smallint[], text[], text[], text, boolean, text)
  to anon, authenticated;

create or replace function public.get_practice(p_id uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'practice', app.practice_json(p),
    'doctors', coalesce((select jsonb_agg(app.doctor_json(d) order by d.name) from public.doctors d where d.practice_id = p.id), '[]'),
    'lastSyncedAt', (select max(last_synced_at) from public.availability_sources s where s.practice_id = p.id)
  )
  from public.practices p where p.id = p_id
$$;
grant execute on function public.get_practice(uuid) to anon, authenticated;

create or replace function public.get_slots(p_practice_id uuid, p_from timestamptz, p_to timestamptz) returns setof jsonb
language sql stable
set search_path = public
as $$
  select app.slot_json(s)
  from public.availability_slots s
  where s.practice_id = p_practice_id
    and s.starts_at between p_from and least(p_to, p_from + interval '31 days')
    and s.status <> 'cancelled'
  order by s.starts_at
$$;
grant execute on function public.get_slots(uuid, timestamptz, timestamptz) to anon, authenticated;

-- Eigene Daten (entschlüsselt, nur für auth.uid()) --------------------------------
create or replace function public.get_my_appointments() returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id, 'slotId', a.slot_id, 'practiceId', a.practice_id, 'doctorId', a.doctor_id,
      'dependentId', a.dependent_id, 'reasonCategory', app.decrypt(a.reason_category_enc),
      'status', case when a.status = 'confirmed' and a.ends_at < app.now() then 'completed' else a.status::text end,
      'startsAt', a.starts_at, 'endsAt', a.ends_at, 'visitType', a.visit_type,
      'createdAt', a.created_at, 'cancelledAt', a.cancelled_at,
      'practice', app.practice_json(p), 'doctor', app.doctor_json(d),
      'patientLabel', app.decrypt(dep.label_enc)
    ) order by a.starts_at), '[]'::jsonb)
  from public.appointments a
  join public.practices p on p.id = a.practice_id
  join public.doctors d on d.id = a.doctor_id
  left join public.dependents dep on dep.id = a.dependent_id
  where a.user_id = auth.uid()
$$;

create or replace function public.get_my_dependents() returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', app.decrypt(label_enc), 'ageGroup', age_group) order by created_at), '[]')
  from public.dependents where owner_id = auth.uid()
$$;

create or replace function public.get_my_contact() returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object('fullName', app.decrypt(c.full_name_enc), 'phone', app.decrypt(c.phone_enc), 'insurance', c.insurance)
  from public.booking_contacts c
  join public.appointments a on a.id = c.appointment_id
  where a.user_id = auth.uid()
  order by a.created_at desc
  limit 1
$$;

create or replace function public.get_my_waitlist() returns jsonb
language sql stable security definer
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'target', case
      when e.practice_id is not null then jsonb_build_object('kind', 'practice', 'practiceId', e.practice_id)
      when e.doctor_id is not null then jsonb_build_object('kind', 'doctor', 'doctorId', e.doctor_id)
      else jsonb_build_object('kind', 'specialty', 'specialtyId', e.specialty_id,
        'center', jsonb_build_object('lat', st_y(e.center::geometry), 'lng', st_x(e.center::geometry))) end,
    'windowStart', lower(e.time_window), 'windowEnd', upper(e.time_window),
    'maxDistanceKm', e.max_distance_km, 'status', e.status, 'createdAt', e.created_at,
    'practiceName', coalesce(p.name, pd.name),
    'label', coalesce(p.name, pd.name, s.slug)
  ) order by e.created_at), '[]')
  from public.waitlist_entries e
  left join public.practices p on p.id = e.practice_id
  left join public.doctors d on d.id = e.doctor_id
  left join public.practices pd on pd.id = d.practice_id
  left join public.specialties s on s.id = e.specialty_id
  where e.user_id = auth.uid() and e.status = 'active'
$$;

create or replace function public.get_my_offers() returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'entryId', o.entry_id, 'offeredAt', o.offered_at, 'expiresAt', o.expires_at,
    'status', case when o.status = 'pending' and o.expires_at <= app.now() then 'expired' else o.status::text end,
    'slot', app.slot_json(s), 'practice', app.practice_json(p), 'doctor', app.doctor_json(d)
  ) order by o.offered_at desc), '[]')
  from public.waitlist_offers o
  join public.availability_slots s on s.id = o.slot_id
  join public.practices p on p.id = s.practice_id
  join public.doctors d on d.id = s.doctor_id
  where o.user_id = auth.uid() and o.offered_at > app.now() - interval '7 days'
$$;

revoke execute on function public.get_my_appointments(), public.get_my_dependents(), public.get_my_contact(),
  public.get_my_waitlist(), public.get_my_offers() from public, anon;
grant execute on function public.get_my_appointments(), public.get_my_dependents(), public.get_my_contact(),
  public.get_my_waitlist(), public.get_my_offers() to authenticated;
