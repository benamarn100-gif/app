-- MedNow · Praxis-Dashboard (PracticeDashboardProvider, docs/data-sources.md)
--
-- Praxis-Mitarbeitende pflegen Slots und Wochenvorlagen im Web-Dashboard (dashboard/).
-- Zugriff nur für Mitglieder der Praxis mit Zwei-Faktor-Anmeldung (JWT-Claim aal = aal2).
-- Alle Lese- und Schreibzugriffe laufen über security-definer-RPCs mit Mitgliedschaftsprüfung;
-- direkte Tabellenrechte gibt es nicht (docs/decisions.md D-41).

create type public.practice_role as enum ('owner', 'staff');

create table public.practice_members (
  practice_id uuid not null references public.practices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.practice_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (practice_id, user_id)
);
create index practice_members_user_idx on public.practice_members (user_id);

-- Wiederkehrende Sprechzeiten je Ärztin/Arzt. Uhrzeiten in Berliner Ortszeit,
-- Umrechnung nach UTC erst beim Anwenden (DST-sicher).
create table public.practice_slot_templates (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices (id) on delete cascade,
  doctor_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7), -- ISO 8601: 1 = Montag … 7 = Sonntag
  start_time time not null,
  end_time time not null,
  slot_minutes smallint not null check (slot_minutes between 5 and 120),
  visit_type public.visit_type not null default 'in_person',
  created_at timestamptz not null default now(),
  foreign key (doctor_id, practice_id) references public.doctors (id, practice_id) on delete cascade,
  -- time - time ergibt ein Intervall (kein Überlauf über Mitternacht wie bei time + interval)
  constraint template_fits check (end_time - start_time >= make_interval(mins => slot_minutes))
);
create index slot_templates_practice_idx on public.practice_slot_templates (practice_id, doctor_id, weekday);

-- Zugriffsprotokoll: wer hat wann Patientendaten gesehen oder Termine geändert (Art. 32 DSGVO).
create table app.practice_audit_log (
  id bigserial primary key,
  practice_id uuid not null references public.practices (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target uuid,
  details jsonb not null default '{}',
  at timestamptz not null default now()
);
create index practice_audit_idx on app.practice_audit_log (practice_id, at);

alter table public.practice_members enable row level security;
alter table public.practice_slot_templates enable row level security;
alter table app.practice_audit_log enable row level security;

create policy "Eigene Praxis-Mitgliedschaften" on public.practice_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Vorlagen der eigenen Praxis" on public.practice_slot_templates for select to authenticated
  using (exists (
    select 1 from public.practice_members m
    where m.practice_id = practice_slot_templates.practice_id and m.user_id = (select auth.uid())
  ));
revoke insert, update, delete, truncate on public.practice_members, public.practice_slot_templates from anon, authenticated;
revoke select on public.practice_members, public.practice_slot_templates from anon;
revoke all on app.practice_audit_log from anon, authenticated;

-- Hilfsfunktionen ---------------------------------------------------------------

-- Zwei-Faktor-Anmeldung: Patientendaten nur mit aal2 (TOTP über Supabase Auth MFA).
create or replace function app.require_aal2() returns uuid
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    perform app.raise_app_error('unauthorized');
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    perform app.raise_app_error('mfa_required');
  end if;
  return auth.uid();
end;
$$;

create or replace function app.require_practice_member(p_practice uuid) returns public.practice_role
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := app.require_aal2();
  v_role public.practice_role;
begin
  select role into v_role from public.practice_members where practice_id = p_practice and user_id = v_user;
  if not found then
    perform app.raise_app_error('forbidden');
  end if;
  return v_role;
end;
$$;

create or replace function app.audit(p_practice uuid, p_action text, p_target uuid default null, p_details jsonb default '{}')
returns void
language sql security definer
set search_path = ''
as $$
  insert into app.practice_audit_log (practice_id, user_id, action, target, details, at)
  values (p_practice, auth.uid(), p_action, p_target, p_details, app.now());
$$;

-- Jede Änderung im Dashboard bestätigt die Aktualität (→ „Aktualisiert vor X Min.“).
create or replace function app.touch_dashboard_source(p_practice uuid) returns timestamptz
language sql security definer
set search_path = public
as $$
  insert into public.availability_sources (practice_id, provider, last_synced_at)
  values (p_practice, 'practice_dashboard', app.now())
  on conflict (practice_id, provider) do update set last_synced_at = excluded.last_synced_at
  returning last_synced_at;
$$;

-- Slot für das Dashboard: zusätzlich Quelle und ob über MedNow gebucht (ohne Personendaten).
create or replace function app.dashboard_slot_json(s public.availability_slots) returns jsonb
language sql stable
set search_path = public
as $$
  select app.slot_json(s) || jsonb_build_object(
    'source', s.source,
    'appointmentId', (select a.id from public.appointments a where a.slot_id = s.id and a.status = 'confirmed')
  )
$$;

create or replace function app.template_json(t public.practice_slot_templates) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id, 'doctorId', t.doctor_id, 'weekday', t.weekday,
    'startTime', to_char(t.start_time, 'HH24:MI'), 'endTime', to_char(t.end_time, 'HH24:MI'),
    'slotMinutes', t.slot_minutes, 'visitType', t.visit_type
  )
$$;

create or replace function app.check_dashboard_range(p_from timestamptz, p_to timestamptz) returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '32 days' then
    perform app.raise_app_error('invalid_input');
  end if;
end;
$$;

-- Lesen ---------------------------------------------------------------------------

create or replace function public.dashboard_my_practices() returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := app.require_aal2();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('practice', app.practice_json(p), 'role', m.role) order by p.name)
    from public.practice_members m
    join public.practices p on p.id = m.practice_id
    where m.user_id = v_user
  ), '[]'::jsonb);
end;
$$;

-- Wochenansicht: Praxis, Ärztinnen/Ärzte, Slots (ohne stornierte), Aktualität.
create or replace function public.dashboard_week(p_practice uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_role public.practice_role := app.require_practice_member(p_practice);
begin
  perform app.check_dashboard_range(p_from, p_to);
  return jsonb_build_object(
    'role', v_role,
    'practice', (select app.practice_json(p) from public.practices p where p.id = p_practice),
    'doctors', coalesce((
      select jsonb_agg(app.doctor_json(d) order by d.name) from public.doctors d where d.practice_id = p_practice
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(app.dashboard_slot_json(s) order by s.starts_at, s.doctor_id)
      from public.availability_slots s
      where s.practice_id = p_practice and s.status <> 'cancelled'
        and s.starts_at >= p_from and s.starts_at < p_to
    ), '[]'::jsonb),
    'lastSyncedAt', (select max(last_synced_at) from public.availability_sources where practice_id = p_practice),
    'serverNow', app.now()
  );
end;
$$;

-- Buchungen mit entschlüsselten Kontaktdaten. Stornierte Termine ohne Kontaktdaten
-- (Datensparsamkeit). Jeder Abruf wird protokolliert.
create or replace function public.dashboard_bookings(p_practice uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform app.require_practice_member(p_practice);
  perform app.check_dashboard_range(p_from, p_to);
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'slotId', a.slot_id, 'doctorId', a.doctor_id,
      'startsAt', a.starts_at, 'endsAt', a.ends_at, 'visitType', a.visit_type, 'status', a.status,
      'reasonCategory', app.decrypt(a.reason_category_enc),
      'forDependent', a.dependent_id is not null,
      'dependentAgeGroup', dep.age_group,
      'contact', case when a.status = 'confirmed' then jsonb_build_object(
        'fullName', app.decrypt(c.full_name_enc), 'phone', app.decrypt(c.phone_enc), 'insurance', c.insurance
      ) end,
      'createdAt', a.created_at, 'cancelledAt', a.cancelled_at
    ) order by a.starts_at, a.doctor_id), '[]'::jsonb)
  into v_result
  from public.appointments a
  left join public.booking_contacts c on c.appointment_id = a.id
  left join public.dependents dep on dep.id = a.dependent_id
  where a.practice_id = p_practice and a.starts_at >= p_from and a.starts_at < p_to;

  perform app.audit(p_practice, 'view_bookings', null,
    jsonb_build_object('from', p_from, 'to', p_to, 'count', jsonb_array_length(v_result)));
  return v_result;
end;
$$;

create or replace function public.dashboard_templates(p_practice uuid) returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
  perform app.require_practice_member(p_practice);
  return coalesce((
    select jsonb_agg(app.template_json(t) order by t.doctor_id, t.weekday, t.start_time)
    from public.practice_slot_templates t where t.practice_id = p_practice
  ), '[]'::jsonb);
end;
$$;

-- Schreiben -------------------------------------------------------------------------

-- Einzelnen Slot anlegen. Neue Slots lösen Realtime-Broadcast und Warteliste aus (Trigger).
create or replace function public.dashboard_create_slot(
  p_practice uuid,
  p_doctor uuid,
  p_starts_at timestamptz,
  p_minutes integer,
  p_visit_type public.visit_type default 'in_person'
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_now timestamptz := app.now();
  v_slot public.availability_slots;
begin
  perform app.require_practice_member(p_practice);
  if p_minutes is null or p_minutes not between 5 and 120
     or p_starts_at is null or p_starts_at <= v_now or p_starts_at > v_now + interval '120 days'
     or not exists (select 1 from public.doctors where id = p_doctor and practice_id = p_practice) then
    perform app.raise_app_error('invalid_input');
  end if;
  begin
    insert into public.availability_slots (doctor_id, practice_id, starts_at, ends_at, status, visit_type, source)
    values (p_doctor, p_practice, p_starts_at, p_starts_at + make_interval(mins => p_minutes), 'open',
            coalesce(p_visit_type, 'in_person'), 'practice_dashboard')
    returning * into v_slot;
  exception when exclusion_violation then
    perform app.raise_app_error('slot_overlap');
  end;
  perform app.touch_dashboard_source(p_practice);
  perform app.audit(p_practice, 'create_slot', v_slot.id);
  -- Der Trigger kann den Slot bereits der Warteliste angeboten haben → aktuellen Stand liefern.
  select * into v_slot from public.availability_slots where id = v_slot.id;
  return app.dashboard_slot_json(v_slot);
end;
$$;

-- Freien Slot entfernen. Gebuchte oder gerade reservierte Slots bleiben unangetastet.
create or replace function public.dashboard_cancel_slot(p_practice uuid, p_slot uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_now timestamptz := app.now();
  v_slot public.availability_slots;
begin
  perform app.require_practice_member(p_practice);
  update public.availability_slots s
     set status = 'cancelled', held_until = null, held_by = null, hold_reason = null
   where s.id = p_slot and s.practice_id = p_practice
     and (s.status = 'open' or (s.status = 'held' and s.hold_reason = 'checkout' and s.held_until <= v_now))
  returning * into v_slot;
  if not found then
    select * into v_slot from public.availability_slots where id = p_slot and practice_id = p_practice;
    if not found or v_slot.status = 'cancelled' then
      perform app.raise_app_error('not_found');
    elsif v_slot.status = 'booked' then
      perform app.raise_app_error('slot_booked');
    else
      perform app.raise_app_error('slot_held');
    end if;
  end if;
  perform app.touch_dashboard_source(p_practice);
  perform app.audit(p_practice, 'cancel_slot', p_slot);
end;
$$;

-- Termin durch die Praxis absagen: Termin storniert, Slot entfällt, Patient:in bekommt
-- eine datensparsame Push-Nachricht (ohne Praxis, Arzt, Fachrichtung).
create or replace function public.dashboard_cancel_appointment(p_practice uuid, p_appointment uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
begin
  perform app.require_practice_member(p_practice);
  update public.appointments
     set status = 'cancelled', cancelled_at = app.now()
   where id = p_appointment and practice_id = p_practice and status = 'confirmed' and starts_at > app.now()
  returning * into v_appt;
  if not found then
    perform app.raise_app_error('not_found');
  end if;
  update public.availability_slots
     set status = 'cancelled', held_until = null, held_by = null, hold_reason = null
   where id = v_appt.slot_id;
  insert into app.notification_outbox (user_id, kind, payload)
  values (v_appt.user_id, 'appointment_cancelled_by_practice', jsonb_build_object('appointmentId', v_appt.id));
  perform app.touch_dashboard_source(p_practice);
  perform app.audit(p_practice, 'cancel_appointment', v_appt.id);
end;
$$;

create or replace function public.dashboard_add_template(
  p_practice uuid,
  p_doctor uuid,
  p_weekday integer,
  p_start time,
  p_end time,
  p_minutes integer,
  p_visit_type public.visit_type default 'in_person'
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_template public.practice_slot_templates;
begin
  perform app.require_practice_member(p_practice);
  if p_weekday is null or p_weekday not between 1 and 7
     or p_minutes is null or p_minutes not between 5 and 120
     or p_start is null or p_end is null or p_end - p_start < make_interval(mins => p_minutes)
     or not exists (select 1 from public.doctors where id = p_doctor and practice_id = p_practice) then
    perform app.raise_app_error('invalid_input');
  end if;
  if exists (
    select 1 from public.practice_slot_templates t
    where t.doctor_id = p_doctor and t.weekday = p_weekday and t.start_time < p_end and p_start < t.end_time
  ) then
    perform app.raise_app_error('template_overlap');
  end if;
  insert into public.practice_slot_templates (practice_id, doctor_id, weekday, start_time, end_time, slot_minutes, visit_type)
  values (p_practice, p_doctor, p_weekday, p_start, p_end, p_minutes, coalesce(p_visit_type, 'in_person'))
  returning * into v_template;
  perform app.audit(p_practice, 'add_template', v_template.id);
  return app.template_json(v_template);
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

-- Wochenvorlage auf p_weeks Wochen ab p_from (Berliner Datum) anwenden.
-- Idempotent: bestehende/überlappende Slots werden übersprungen (Exclusion-Constraint).
create or replace function public.dashboard_apply_templates(p_practice uuid, p_from date, p_weeks integer) returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_now timestamptz := app.now();
  v_today date := (app.now() at time zone 'Europe/Berlin')::date;
  v_t public.practice_slot_templates;
  v_day date;
  v_local timestamp;
  v_start timestamptz;
  v_count integer := 0;
  v_inserted integer;
begin
  perform app.require_practice_member(p_practice);
  if p_from is null or p_weeks is null or p_weeks not between 1 and 8
     or p_from < v_today - 7 or p_from > v_today + 120 then
    perform app.raise_app_error('invalid_input');
  end if;

  for v_t in select * from public.practice_slot_templates where practice_id = p_practice order by doctor_id, weekday, start_time loop
    for v_day in
      select p_from + i from generate_series(0, p_weeks * 7 - 1) i
      where extract(isodow from p_from + i) = v_t.weekday
    loop
      v_local := v_day + v_t.start_time;
      while v_local + make_interval(mins => v_t.slot_minutes) <= v_day + v_t.end_time loop
        v_start := v_local at time zone 'Europe/Berlin';
        if v_start > v_now then
          insert into public.availability_slots (doctor_id, practice_id, starts_at, ends_at, status, visit_type, source)
          values (v_t.doctor_id, p_practice, v_start, v_start + make_interval(mins => v_t.slot_minutes), 'open',
                  v_t.visit_type, 'practice_dashboard')
          on conflict do nothing;
          get diagnostics v_inserted = row_count;
          v_count := v_count + v_inserted;
        end if;
        v_local := v_local + make_interval(mins => v_t.slot_minutes);
      end loop;
    end loop;
  end loop;

  perform app.touch_dashboard_source(p_practice);
  perform app.audit(p_practice, 'apply_templates', null,
    jsonb_build_object('from', p_from, 'weeks', p_weeks, 'created', v_count));
  return v_count;
end;
$$;

-- „Alles aktuell“: bestätigt die Verfügbarkeit ohne Änderung (sonst nach 24 h „Unbekannt“).
create or replace function public.dashboard_confirm_availability(p_practice uuid) returns timestamptz
language plpgsql security definer
set search_path = public
as $$
begin
  perform app.require_practice_member(p_practice);
  return app.touch_dashboard_source(p_practice);
end;
$$;

-- Verwaltung (nur service_role, z. B. im SQL-Editor) -----------------------------------
-- Ablauf: Person unter Authentication → Users einladen, dann
--   select app.add_practice_member('<practice-id>', 'praxis@example.org', 'owner');
create or replace function app.add_practice_member(p_practice uuid, p_email text, p_role public.practice_role default 'staff')
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if not found then
    perform app.raise_app_error('not_found');
  end if;
  insert into public.practice_members (practice_id, user_id, role) values (p_practice, v_user, p_role)
  on conflict (practice_id, user_id) do update set role = excluded.role;
  update public.practices set verified_at = coalesce(verified_at, app.now()) where id = p_practice;
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

-- Aufbewahrung: Zugriffsprotokoll 12 Monate (mit den Terminen abgeglichen, vor Launch prüfen).
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

-- Rechte ----------------------------------------------------------------------------
revoke all on function
  app.require_aal2(),
  app.require_practice_member(uuid),
  app.audit(uuid, text, uuid, jsonb),
  app.touch_dashboard_source(uuid),
  app.dashboard_slot_json(public.availability_slots),
  app.template_json(public.practice_slot_templates),
  app.check_dashboard_range(timestamptz, timestamptz),
  app.add_practice_member(uuid, text, public.practice_role),
  app.remove_practice_member(uuid, text)
from public, anon, authenticated;
grant execute on function
  app.add_practice_member(uuid, text, public.practice_role),
  app.remove_practice_member(uuid, text)
to service_role;

revoke all on function
  public.dashboard_my_practices(),
  public.dashboard_week(uuid, timestamptz, timestamptz),
  public.dashboard_bookings(uuid, timestamptz, timestamptz),
  public.dashboard_templates(uuid),
  public.dashboard_create_slot(uuid, uuid, timestamptz, integer, public.visit_type),
  public.dashboard_cancel_slot(uuid, uuid),
  public.dashboard_cancel_appointment(uuid, uuid),
  public.dashboard_add_template(uuid, uuid, integer, time, time, integer, public.visit_type),
  public.dashboard_delete_template(uuid, uuid),
  public.dashboard_apply_templates(uuid, date, integer),
  public.dashboard_confirm_availability(uuid)
from public, anon;
grant execute on function
  public.dashboard_my_practices(),
  public.dashboard_week(uuid, timestamptz, timestamptz),
  public.dashboard_bookings(uuid, timestamptz, timestamptz),
  public.dashboard_templates(uuid),
  public.dashboard_create_slot(uuid, uuid, timestamptz, integer, public.visit_type),
  public.dashboard_cancel_slot(uuid, uuid),
  public.dashboard_cancel_appointment(uuid, uuid),
  public.dashboard_add_template(uuid, uuid, integer, time, time, integer, public.visit_type),
  public.dashboard_delete_template(uuid, uuid),
  public.dashboard_apply_templates(uuid, date, integer),
  public.dashboard_confirm_availability(uuid)
to authenticated;
