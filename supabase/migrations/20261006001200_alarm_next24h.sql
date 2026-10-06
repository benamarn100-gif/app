-- MedNow · Termin-Alarm „nächste 24 Stunden“ (p_days = 1).
-- Nutzen: Wer heute noch zum Arzt muss, bekommt sofort Bescheid, wenn in den nächsten
-- 24 Stunden ein passender Termin frei wird – statt mehrmals am Tag nachzusehen.
-- Sonst unverändert gegenüber Migration 0500.

create or replace function app.join_waitlist(
  p_user uuid,
  p_practice uuid,
  p_doctor uuid,
  p_specialty smallint,
  p_lat double precision,
  p_lng double precision,
  p_days integer,
  p_max_km integer
) returns uuid
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_now timestamptz := app.now();
begin
  if not exists (select 1 from public.consents where user_id = p_user and type = 'health_data' and revoked_at is null) then
    perform app.raise_app_error('consent_missing');
  end if;
  if p_days not in (1, 3, 7, 14) or p_max_km not between 1 and 50 then
    perform app.raise_app_error('invalid_input');
  end if;
  if (select count(*) from public.waitlist_entries where user_id = p_user and status = 'active') >= 10 then
    perform app.raise_app_error('rate_limited');
  end if;
  insert into public.waitlist_entries (user_id, practice_id, doctor_id, specialty_id, center, time_window, max_distance_km)
  values (
    p_user, p_practice, p_doctor, p_specialty,
    case when p_lat is null or p_lng is null then null
         else st_setsrid(st_makepoint(round(p_lng::numeric, 3), round(p_lat::numeric, 3)), 4326)::geography end,
    tstzrange(v_now, v_now + make_interval(days => p_days), '[)'),
    p_max_km
  ) returning id into v_id;
  return v_id;
end;
$$;
