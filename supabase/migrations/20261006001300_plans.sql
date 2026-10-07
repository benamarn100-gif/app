-- MedNow · Abo-Stufen auf dem Server (Phase 4).
-- Die App zeigt Grenzen nur an; durchgesetzt werden sie hier. Fairness-Regel: Die Stufe
-- ändert nie die Reihenfolge auf Termin-Alarmen (FIFO nach Eintragung, 10 Minuten für alle) –
-- nur Anzahl und Laufzeit. Bestehende Alarme/Profile bleiben bei einem Downgrade bestehen.

create table app.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('plus', 'family')),
  -- null = ohne Ablauf (nur für manuelle Freischaltungen)
  expires_at timestamptz,
  product_id text,
  source text not null default 'revenuecat' check (source in ('revenuecat', 'manual')),
  updated_at timestamptz not null default now()
);
alter table app.entitlements enable row level security;
revoke all on app.entitlements from anon, authenticated;

create or replace function app.plan_for(p_user uuid) returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select e.plan from app.entitlements e
      where e.user_id = p_user and (e.expires_at is null or e.expires_at > app.now())),
    'free')
$$;

-- Gleiche Werte wie src/domain/plans.ts (PLAN_LIMITS)
create or replace function app.plan_limits(p_plan text, out active_alarms integer, out profiles integer, out max_days integer)
language sql immutable
set search_path = ''
as $$
  select case p_plan when 'free' then 1 else 10 end,
         case p_plan when 'family' then 5 else 2 end,
         case p_plan when 'free' then 14 else 60 end
$$;

-- Nur für die Edge Function billing_webhook (service_role). p_plan null = Abo beendet.
create or replace function app.set_entitlement(p_user uuid, p_plan text, p_expires_at timestamptz, p_product text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_plan is null then
    delete from app.entitlements where user_id = p_user and source = 'revenuecat';
    return;
  end if;
  if p_plan not in ('plus', 'family') then
    perform app.raise_app_error('invalid_input');
  end if;
  insert into app.entitlements (user_id, plan, expires_at, product_id, source, updated_at)
  values (p_user, p_plan, p_expires_at, p_product, 'revenuecat', now())
  on conflict (user_id) do update
    set plan = excluded.plan, expires_at = excluded.expires_at,
        product_id = excluded.product_id, updated_at = now()
    where app.entitlements.source = 'revenuecat';
end;
$$;

-- Eigene Stufe für die App (nur lesen)
create or replace function public.get_my_plan() returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'plan', app.plan_for(auth.uid()),
    'expiresAt', (select e.expires_at from app.entitlements e where e.user_id = auth.uid())
  )
$$;

revoke all on function app.plan_for(uuid), app.set_entitlement(uuid, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function app.plan_for(uuid), app.set_entitlement(uuid, text, timestamptz, text)
  to service_role;
grant execute on function app.plan_limits(text) to service_role;
revoke all on function public.get_my_plan() from public, anon;
grant execute on function public.get_my_plan() to authenticated;

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
  v_limits record;
begin
  select * into v_limits from app.plan_limits(app.plan_for(p_user));
  if not exists (select 1 from public.consents where user_id = p_user and type = 'health_data' and revoked_at is null) then
    perform app.raise_app_error('consent_missing');
  end if;
  if p_days not in (1, 3, 7, 14, 30, 60) or p_max_km not between 1 and 50 then
    perform app.raise_app_error('invalid_input');
  end if;
  -- Stufe: Laufzeit und Anzahl gleichzeitiger Alarme (nie die Reihenfolge – FIFO für alle)
  if p_days > v_limits.max_days then
    perform app.raise_app_error('plan_limit');
  end if;
  if (select count(*) from public.waitlist_entries where user_id = p_user and status = 'active') >= v_limits.active_alarms then
    perform app.raise_app_error('plan_limit');
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

create or replace function app.add_dependent(p_user uuid, p_label text, p_age_group public.age_group) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_dep public.dependents;
begin
  if char_length(coalesce(trim(p_label), '')) not between 1 and 40 then
    perform app.raise_app_error('invalid_input');
  end if;
  -- Profile inkl. „Ich“: kostenlos/Plus 2, Familie 5
  if (select count(*) from public.dependents where owner_id = p_user) + 1
       >= (select profiles from app.plan_limits(app.plan_for(p_user))) then
    perform app.raise_app_error('plan_limit');
  end if;
  insert into public.dependents (owner_id, label_enc, age_group)
  values (p_user, app.encrypt(trim(p_label)), p_age_group)
  returning * into v_dep;
  return jsonb_build_object('id', v_dep.id, 'label', trim(p_label), 'ageGroup', v_dep.age_group);
end;
$$;
