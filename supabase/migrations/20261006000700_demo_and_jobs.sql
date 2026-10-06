-- MedNow · Demo-Datenquelle (SeedProvider) und geplante Jobs.
-- Demo-Praxen/Ärzte kommen aus supabase/seed.sql (generiert aus src/domain/seed).
-- Slots erzeugt die Datenbank selbst und rollt das 14-Tage-Fenster täglich weiter.

create table app.demo_doctor_profiles (
  doctor_id uuid primary key references public.doctors (id) on delete cascade,
  slot_minutes smallint not null check (slot_minutes between 5 and 120),
  offer_rate numeric(3, 2) not null check (offer_rate between 0 and 1),
  booked_rate numeric(4, 3) not null check (booked_rate between 0 and 1)
);

create table app.demo_sync_profiles (
  practice_id uuid primary key references public.practices (id) on delete cascade,
  sync_age_minutes integer not null check (sync_age_minutes >= 0)
);

-- Deterministischer Zufallswert in [0, 1) aus einem Text
create or replace function app.hash01(p text) returns double precision
language sql immutable
set search_path = ''
as $$
  select (('x' || substr(md5(p), 1, 8))::bit(32)::bigint % 10000) / 10000.0
$$;

create or replace function app.demo_generate_slots(p_days integer default 14) returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_today date := (app.now() at time zone 'Europe/Berlin')::date;
  v_prof record;
  v_day date;
  v_dow text;
  v_period jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_key text;
  v_near double precision;
  v_count integer := 0;
  v_inserted integer;
begin
  perform set_config('app.skip_broadcast', 'on', true);
  for v_prof in
    select dp.*, d.practice_id, p.opening_hours, p.offers_video
    from app.demo_doctor_profiles dp
    join public.doctors d on d.id = dp.doctor_id
    join public.practices p on p.id = d.practice_id
    where p.is_demo
  loop
    for i in 0 .. p_days - 1 loop
      v_day := v_today + i;
      v_dow := (array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])[extract(dow from v_day)::int + 1];
      for v_period in select value from jsonb_array_elements(coalesce(v_prof.opening_hours -> v_dow, '[]'::jsonb)) loop
        v_start := (v_day + (v_period ->> 'open')::time) at time zone 'Europe/Berlin';
        v_end := (v_day + (v_period ->> 'close')::time) at time zone 'Europe/Berlin';
        while v_start + make_interval(mins => v_prof.slot_minutes) <= v_end loop
          v_key := v_prof.doctor_id::text || ':' || to_char(v_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI');
          if app.hash01('offer:' || v_key) < v_prof.offer_rate then
            v_near := case when i = 0 then 1.08 when i = 1 then 1.04 else 1 end;
            insert into public.availability_slots (doctor_id, practice_id, starts_at, ends_at, status, visit_type, source)
            values (
              v_prof.doctor_id, v_prof.practice_id, v_start, v_start + make_interval(mins => v_prof.slot_minutes),
              case when app.hash01('booked:' || v_key) < least(0.995, v_prof.booked_rate * v_near)
                   then 'booked'::public.slot_status else 'open'::public.slot_status end,
              case when v_prof.offers_video and app.hash01('video:' || v_key) < 0.2
                   then 'video'::public.visit_type else 'in_person'::public.visit_type end,
              'seed'
            )
            on conflict do nothing;
            get diagnostics v_inserted = row_count;
            v_count := v_count + v_inserted;
          end if;
          v_start := v_start + make_interval(mins => v_prof.slot_minutes);
        end loop;
      end loop;
    end loop;
  end loop;
  perform set_config('app.skip_broadcast', 'off', true);
  return v_count;
end;
$$;

-- Hält die „Aktualisiert vor X Min.“-Angaben der Demo realistisch (einige bleiben bewusst veraltet).
create or replace function app.demo_touch_sources() returns void
language sql security definer
set search_path = public
as $$
  insert into public.availability_sources (practice_id, provider, last_synced_at)
  select sp.practice_id, 'seed', app.now() - make_interval(mins => sp.sync_age_minutes)
  from app.demo_sync_profiles sp
  on conflict (practice_id, provider) do update set last_synced_at = excluded.last_synced_at;
$$;

create or replace function app.demo_roll_slots() returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform set_config('app.skip_broadcast', 'on', true);
  delete from public.availability_slots s
   using public.practices p
   where p.id = s.practice_id and p.is_demo
     and s.ends_at < app.now() - interval '1 day'
     and not exists (select 1 from public.appointments a where a.slot_id = s.id)
     and not exists (select 1 from public.waitlist_offers o where o.slot_id = s.id);
  v_count := app.demo_generate_slots(14);
  perform app.demo_touch_sources();
  return v_count;
end;
$$;

revoke all on function app.demo_generate_slots(integer), app.demo_touch_sources(), app.demo_roll_slots() from public, anon, authenticated;
grant execute on function app.demo_generate_slots(integer), app.demo_touch_sources(), app.demo_roll_slots() to service_role;

-- Jobs (pg_cron). Lokal/ohne pg_cron werden sie übersprungen.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('mednow-expire-holds', '30 seconds', 'select app.expire_holds_and_offers()');
    perform cron.schedule('mednow-push-retry', '* * * * *', 'select app.notify_push_worker()');
    perform cron.schedule('mednow-demo-touch', '7 * * * *', 'select app.demo_touch_sources()');
    -- 01:05 UTC ≈ 03:05 Berlin
    perform cron.schedule('mednow-demo-roll', '5 1 * * *', 'select app.demo_roll_slots()');
    perform cron.schedule('mednow-retention', '17 2 * * *', 'select app.retention()');
  end if;
end;
$$;

-- Das Schema "app" ist für die Edge Functions (service_role) über die API erreichbar.
-- Interne Tabellen daher zusätzlich mit RLS ohne Policies absichern (nur service_role).
alter table app.demo_doctor_profiles enable row level security;
alter table app.demo_sync_profiles enable row level security;
revoke all on all tables in schema app from anon, authenticated;
