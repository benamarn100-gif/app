-- MedNow · Funktionen mit Lösch-Anweisungen erneut sicherstellen (idempotent).
--
-- Hintergrund: Beim Einrichten des gehosteten Projekts (Frankfurt) über den Supabase-Connector
-- wurden Funktionen, die DELETE-Anweisungen enthalten, zurückgestellt, weil der Connector dafür
-- eine Bestätigung verlangt. Diese Migration legt sie mit derselben Definition wie in 0600/0700/0800
-- an (letzter Stand: retention aus 0800). Lokal und in frischen Projekten ändert sie nichts.

create or replace function app.remove_dependent(p_user uuid, p_id uuid) returns void
language sql security definer
set search_path = public
as $$
  delete from public.dependents where id = p_id and owner_id = p_user;
$$;

create or replace function app.revoke_consent(p_user uuid, p_type public.consent_type) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_entry record;
begin
  update public.consents set revoked_at = app.now() where user_id = p_user and type = p_type and revoked_at is null;
  if p_type = 'health_data' then
    -- Ohne Einwilligung keine Warteliste (Angebote würden Gesundheitsdaten verarbeiten).
    for v_entry in select id from public.waitlist_entries where user_id = p_user and status = 'active' loop
      perform app.leave_waitlist(p_user, v_entry.id);
    end loop;
  end if;
  if p_type = 'push' then
    delete from public.push_tokens where user_id = p_user;
  end if;
end;
$$;

create or replace function app.delete_user_data(p_user uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_appt record;
  v_entry record;
begin
  for v_appt in select id from public.appointments where user_id = p_user and status = 'confirmed' and starts_at > app.now() loop
    perform app.cancel_appointment(p_user, v_appt.id);
  end loop;
  for v_entry in select id from public.waitlist_entries where user_id = p_user and status = 'active' loop
    perform app.leave_waitlist(p_user, v_entry.id);
  end loop;
  update public.availability_slots set status = 'open', held_until = null, held_by = null, hold_reason = null
   where held_by = p_user and status = 'held';
  delete from public.booking_contacts where appointment_id in (select id from public.appointments where user_id = p_user);
  delete from public.waitlist_offers where user_id = p_user;
  delete from public.waitlist_entries where user_id = p_user;
  delete from public.appointments where user_id = p_user;
  delete from public.dependents where owner_id = p_user;
  delete from public.push_tokens where user_id = p_user;
  delete from public.consents where user_id = p_user;
  delete from public.profiles where id = p_user;
  delete from app.notification_outbox where user_id = p_user;
end;
$$;

create or replace function app.retention() returns void
language sql security definer
set search_path = public
as $$
  delete from app.notification_outbox where created_at < app.now() - interval '30 days';
  delete from public.waitlist_offers where offered_at < app.now() - interval '90 days';
  delete from public.waitlist_entries where status <> 'active' and created_at < app.now() - interval '90 days';
  delete from public.booking_contacts where appointment_id in (
    select id from public.appointments where ends_at < app.now() - interval '12 months');
  delete from public.appointments where ends_at < app.now() - interval '12 months';
  delete from app.practice_audit_log where at < app.now() - interval '12 months';
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

create or replace function public.dashboard_delete_template(p_practice uuid, p_template uuid) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  perform app.require_practice_member(p_practice);
  delete from public.practice_slot_templates where id = p_template and practice_id = p_practice;
  if not found then
    perform app.raise_app_error('not_found');
  end if;
  perform app.audit(p_practice, 'delete_template', p_template);
end;
$$;

create or replace function app.remove_practice_member(p_practice uuid, p_email text) returns void
language sql security definer
set search_path = public
as $$
  delete from public.practice_members m
   using auth.users u
   where u.id = m.user_id and m.practice_id = p_practice and lower(u.email) = lower(trim(p_email));
$$;

revoke all on function
  app.remove_dependent(uuid, uuid),
  app.revoke_consent(uuid, public.consent_type),
  app.delete_user_data(uuid),
  app.retention(),
  app.demo_roll_slots(),
  app.remove_practice_member(uuid, text)
from public, anon, authenticated;
grant execute on function
  app.remove_dependent(uuid, uuid),
  app.revoke_consent(uuid, public.consent_type),
  app.delete_user_data(uuid),
  app.demo_roll_slots(),
  app.remove_practice_member(uuid, text)
to service_role;

revoke all on function public.dashboard_delete_template(uuid, uuid) from public, anon;
grant execute on function public.dashboard_delete_template(uuid, uuid) to authenticated;

-- pg_net gehört ins Schema "extensions" (Supabase-Linter 0014). Ältere Stände hatten es in "public";
-- es hält keine Daten, die Funktionen liegen ohnehin im Schema "net".
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net' and extnamespace = 'public'::regnamespace) then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
end;
$$;

-- Täglicher Demo-Job (01:05 UTC ≈ 03:05 Berlin); cron.schedule mit vorhandenem Namen aktualisiert ihn.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('mednow-demo-roll', '5 1 * * *', 'select app.demo_roll_slots()');
  end if;
end;
$$;
