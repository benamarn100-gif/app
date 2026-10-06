-- MedNow · Konto: Profil, Familienmitglieder, Einwilligungen, Push-Tokens, Export, Löschen.

create or replace function app.upsert_profile(
  p_user uuid,
  p_age_group public.age_group,
  p_radius_km integer,
  p_preferred smallint[],
  p_formal boolean,
  p_home_label text,
  p_home_lat double precision,
  p_home_lng double precision
) returns void
language sql security definer
set search_path = public, extensions
as $$
  insert into public.profiles (id, age_group, radius_km, preferred_specialties, formal_address, home_label, home_geo)
  values (
    p_user, p_age_group, p_radius_km, coalesce(p_preferred, '{}'), coalesce(p_formal, false), p_home_label,
    -- Heimatort nur auf ~1 km genau speichern (Datensparsamkeit)
    case when p_home_lat is null or p_home_lng is null then null
         else st_setsrid(st_makepoint(round(p_home_lng::numeric, 2), round(p_home_lat::numeric, 2)), 4326)::geography end
  )
  on conflict (id) do update set
    age_group = excluded.age_group,
    radius_km = excluded.radius_km,
    preferred_specialties = excluded.preferred_specialties,
    formal_address = excluded.formal_address,
    home_label = excluded.home_label,
    home_geo = excluded.home_geo;
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
  if (select count(*) from public.dependents where owner_id = p_user) >= 10 then
    perform app.raise_app_error('rate_limited');
  end if;
  insert into public.dependents (owner_id, label_enc, age_group)
  values (p_user, app.encrypt(trim(p_label)), p_age_group)
  returning * into v_dep;
  return jsonb_build_object('id', v_dep.id, 'label', trim(p_label), 'ageGroup', v_dep.age_group);
end;
$$;

create or replace function app.remove_dependent(p_user uuid, p_id uuid) returns void
language sql security definer
set search_path = public
as $$
  delete from public.dependents where id = p_id and owner_id = p_user;
$$;

-- Einwilligungen sind versioniert und nur widerrufbar, nie nachträglich änderbar.
create or replace function app.grant_consent(p_user uuid, p_type public.consent_type, p_version text) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if char_length(coalesce(p_version, '')) not between 1 and 20 then
    perform app.raise_app_error('invalid_input');
  end if;
  if not exists (
    select 1 from public.consents where user_id = p_user and type = p_type and version = p_version and revoked_at is null
  ) then
    insert into public.consents (user_id, type, version, granted_at) values (p_user, p_type, p_version, app.now());
  end if;
end;
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

create or replace function app.register_push_token(p_user uuid, p_token text, p_platform text, p_locale text, p_formal boolean)
returns void
language sql security definer
set search_path = public
as $$
  insert into public.push_tokens (user_id, token, platform, locale, formal, last_seen_at)
  values (p_user, p_token, p_platform, coalesce(p_locale, 'de'), coalesce(p_formal, false), app.now())
  on conflict (token) do update set
    user_id = excluded.user_id, platform = excluded.platform, locale = excluded.locale,
    formal = excluded.formal, last_seen_at = excluded.last_seen_at;
$$;

-- Datenexport (Art. 15/20 DSGVO) – entschlüsselt, nur eigene Daten.
create or replace function app.export_user_data(p_user uuid) returns jsonb
language sql security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'exportedAt', app.now(),
    'userId', p_user,
    'profile', (select jsonb_build_object('ageGroup', age_group, 'radiusKm', radius_km, 'preferredSpecialties', preferred_specialties,
                 'formalAddress', formal_address, 'homeLabel', home_label, 'createdAt', created_at)
                from public.profiles where id = p_user),
    'dependents', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'label', app.decrypt(label_enc), 'ageGroup', age_group))
                from public.dependents where owner_id = p_user), '[]'),
    'appointments', coalesce((select jsonb_agg(app.appointment_json(a) || jsonb_build_object(
                    'practiceName', (select name from public.practices where id = a.practice_id),
                    'contact', (select jsonb_build_object('fullName', app.decrypt(c.full_name_enc), 'phone', app.decrypt(c.phone_enc), 'insurance', c.insurance)
                                from public.booking_contacts c where c.appointment_id = a.id)))
                from public.appointments a where a.user_id = p_user), '[]'),
    'waitlist', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'status', status, 'createdAt', created_at,
                  'windowStart', lower(time_window), 'windowEnd', upper(time_window), 'maxDistanceKm', max_distance_km))
                from public.waitlist_entries where user_id = p_user), '[]'),
    'consents', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'version', version, 'grantedAt', granted_at, 'revokedAt', revoked_at))
                from public.consents where user_id = p_user), '[]'),
    'pushTokens', (select count(*) from public.push_tokens where user_id = p_user)
  )
$$;

-- Löschen (Art. 17 DSGVO): kommende Termine stornieren (Slots frei), dann Daten löschen.
-- Den Auth-Nutzer löscht die Edge Function anschließend über die Admin-API (Cascade).
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

-- Aufbewahrung: abgelaufene Daten regelmäßig löschen (Fristen: docs/legal-checklist.md).
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
$$;

revoke all on function
  app.upsert_profile(uuid, public.age_group, integer, smallint[], boolean, text, double precision, double precision),
  app.add_dependent(uuid, text, public.age_group),
  app.remove_dependent(uuid, uuid),
  app.grant_consent(uuid, public.consent_type, text),
  app.revoke_consent(uuid, public.consent_type),
  app.register_push_token(uuid, text, text, text, boolean),
  app.export_user_data(uuid),
  app.delete_user_data(uuid),
  app.retention()
from public, anon, authenticated;
grant execute on function
  app.upsert_profile(uuid, public.age_group, integer, smallint[], boolean, text, double precision, double precision),
  app.add_dependent(uuid, text, public.age_group),
  app.remove_dependent(uuid, uuid),
  app.grant_consent(uuid, public.consent_type, text),
  app.revoke_consent(uuid, public.consent_type),
  app.register_push_token(uuid, text, text, text, boolean),
  app.export_user_data(uuid),
  app.delete_user_data(uuid)
to service_role;
