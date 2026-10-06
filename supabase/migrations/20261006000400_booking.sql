-- MedNow · Buchung: Halten (5 Min.), atomares Buchen mit Idempotenz, Storno, Verschieben.
-- Alle Funktionen sind security definer und nur für service_role ausführbar.
-- Aufruf ausschließlich aus Edge Functions, die das Nutzer-JWT geprüft haben.
-- Fehler werden als Exception mit Code-Text gemeldet (z. B. 'slot_taken').

create or replace function app.raise_app_error(p_code text) returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', p_code using errcode = 'P0001';
end;
$$;

create or replace function app.appointment_json(a public.appointments) returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', a.id, 'slotId', a.slot_id, 'practiceId', a.practice_id, 'doctorId', a.doctor_id,
    'dependentId', a.dependent_id, 'reasonCategory', app.decrypt(a.reason_category_enc),
    'status', a.status, 'startsAt', a.starts_at, 'endsAt', a.ends_at, 'visitType', a.visit_type,
    'createdAt', a.created_at, 'cancelledAt', a.cancelled_at
  )
$$;

-- Halten (Checkout) ----------------------------------------------------------
create or replace function app.hold_slot(p_user uuid, p_slot uuid) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_now timestamptz := app.now();
  v_slot public.availability_slots;
begin
  -- Pro Person höchstens ein aktiver Checkout-Hold
  update public.availability_slots
     set status = 'open', held_until = null, held_by = null, hold_reason = null
   where held_by = p_user and status = 'held' and hold_reason = 'checkout' and id <> p_slot;

  update public.availability_slots s
     set status = 'held', held_until = v_now + interval '5 minutes', held_by = p_user, hold_reason = 'checkout'
   where s.id = p_slot
     and s.starts_at > v_now
     and (app.is_bookable(s, v_now) or (s.status = 'held' and s.hold_reason = 'checkout' and s.held_by = p_user))
  returning * into v_slot;

  if not found then
    if not exists (select 1 from public.availability_slots where id = p_slot) then
      perform app.raise_app_error('not_found');
    end if;
    perform app.raise_app_error('slot_taken');
  end if;
  return jsonb_build_object('slot', app.slot_json(v_slot), 'heldUntil', v_slot.held_until);
end;
$$;

create or replace function app.release_hold(p_user uuid, p_slot uuid) returns void
language sql security definer
set search_path = public
as $$
  update public.availability_slots
     set status = 'open', held_until = null, held_by = null, hold_reason = null
   where id = p_slot and status = 'held' and hold_reason = 'checkout' and held_by = p_user;
$$;

-- Buchen -------------------------------------------------------------------
-- Doppelbuchung ist dreifach ausgeschlossen:
--  1. bedingtes UPDATE (nur eine Transaktion gewinnt die Zeile; Konkurrenten sehen
--     nach dem Commit status = 'booked' und bekommen 'slot_taken'),
--  2. partieller Unique-Index appointments(slot_id) where status = 'confirmed',
--  3. Idempotenz-Schlüssel je Nutzer.
create or replace function app.book_slot(
  p_user uuid,
  p_slot uuid,
  p_idempotency_key text,
  p_dependent uuid,
  p_reason public.reason_category,
  p_full_name text,
  p_phone text,
  p_insurance public.insurance_type,
  p_consent_version text,
  p_via_offer uuid default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_now timestamptz := app.now();
  v_existing public.appointments;
  v_slot public.availability_slots;
  v_appt public.appointments;
begin
  if char_length(coalesce(p_idempotency_key, '')) not between 8 and 80 then
    perform app.raise_app_error('invalid_input');
  end if;

  select * into v_existing from public.appointments where user_id = p_user and idempotency_key = p_idempotency_key;
  if found then
    return app.appointment_json(v_existing);
  end if;

  if not exists (
    select 1 from public.consents
    where user_id = p_user and type = 'health_data' and version = p_consent_version and revoked_at is null
  ) then
    perform app.raise_app_error('consent_missing');
  end if;

  if p_dependent is not null and not exists (select 1 from public.dependents where id = p_dependent and owner_id = p_user) then
    perform app.raise_app_error('invalid_input');
  end if;

  if char_length(coalesce(trim(p_full_name), '')) < 2 or coalesce(p_phone, '') !~ '^\+?[0-9 ()/-]{6,20}$' then
    perform app.raise_app_error('invalid_input');
  end if;

  update public.availability_slots s
     set status = 'booked', held_until = null, held_by = null, hold_reason = null
   where s.id = p_slot
     and s.starts_at > v_now
     and (
       app.is_bookable(s, v_now)
       or (s.status = 'held' and s.held_by = p_user and s.held_until > v_now
           and (s.hold_reason = 'checkout' or (s.hold_reason = 'waitlist_offer' and p_via_offer is not null)))
     )
  returning * into v_slot;

  if not found then
    -- Gleichzeitige Anfrage mit demselben Idempotenz-Schlüssel? Dann deren Ergebnis liefern.
    select * into v_existing from public.appointments where user_id = p_user and idempotency_key = p_idempotency_key;
    if found then
      return app.appointment_json(v_existing);
    end if;
    if exists (select 1 from public.availability_slots where id = p_slot and held_by = p_user and status = 'held') then
      perform app.raise_app_error('hold_expired');
    end if;
    if not exists (select 1 from public.availability_slots where id = p_slot) then
      perform app.raise_app_error('not_found');
    end if;
    perform app.raise_app_error('slot_taken');
  end if;

  insert into public.appointments (
    user_id, dependent_id, slot_id, practice_id, doctor_id, starts_at, ends_at, visit_type,
    reason_category_enc, status, idempotency_key
  ) values (
    p_user, p_dependent, v_slot.id, v_slot.practice_id, v_slot.doctor_id, v_slot.starts_at, v_slot.ends_at, v_slot.visit_type,
    app.encrypt(p_reason::text), 'confirmed', p_idempotency_key
  ) returning * into v_appt;

  insert into public.booking_contacts (appointment_id, full_name_enc, phone_enc, insurance)
  values (v_appt.id, app.encrypt(trim(p_full_name)), app.encrypt(trim(p_phone)), p_insurance);

  return app.appointment_json(v_appt);
exception
  when unique_violation then
    -- Letzte Verteidigungslinie: partieller Unique-Index / Idempotenz-Index
    select * into v_existing from public.appointments where user_id = p_user and idempotency_key = p_idempotency_key;
    if found then
      return app.appointment_json(v_existing);
    end if;
    perform app.raise_app_error('slot_taken');
end;
$$;

-- Stornieren: Slot wird frei → Trigger reicht ihn an die Warteliste weiter.
create or replace function app.cancel_appointment(p_user uuid, p_appointment uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
begin
  update public.appointments
     set status = 'cancelled', cancelled_at = app.now()
   where id = p_appointment and user_id = p_user and status = 'confirmed'
  returning * into v_appt;
  if not found then
    perform app.raise_app_error('not_found');
  end if;
  update public.availability_slots
     set status = 'open', held_until = null, held_by = null, hold_reason = null
   where id = v_appt.slot_id and status = 'booked' and starts_at > app.now();
end;
$$;

-- Verschieben: neuer Slot gebucht und alter storniert – in einer Transaktion.
create or replace function app.reschedule_appointment(p_user uuid, p_appointment uuid, p_new_slot uuid, p_idempotency_key text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_old public.appointments;
  v_contact public.booking_contacts;
  v_new jsonb;
  v_consent text;
begin
  select * into v_old from public.appointments where id = p_appointment and user_id = p_user and status = 'confirmed' for update;
  if not found then
    perform app.raise_app_error('not_found');
  end if;
  select * into v_contact from public.booking_contacts where appointment_id = v_old.id;
  select version into v_consent from public.consents
   where user_id = p_user and type = 'health_data' and revoked_at is null order by granted_at desc limit 1;

  v_new := app.book_slot(
    p_user, p_new_slot, p_idempotency_key, v_old.dependent_id,
    app.decrypt(v_old.reason_category_enc)::public.reason_category,
    app.decrypt(v_contact.full_name_enc), app.decrypt(v_contact.phone_enc), v_contact.insurance,
    coalesce(v_consent, '')
  );
  update public.appointments set rescheduled_from = v_old.id where id = (v_new ->> 'id')::uuid;
  perform app.cancel_appointment(p_user, v_old.id);
  return v_new;
end;
$$;

revoke all on function
  app.hold_slot(uuid, uuid),
  app.release_hold(uuid, uuid),
  app.book_slot(uuid, uuid, text, uuid, public.reason_category, text, text, public.insurance_type, text, uuid),
  app.cancel_appointment(uuid, uuid),
  app.reschedule_appointment(uuid, uuid, uuid, text),
  app.appointment_json(public.appointments)
from public, anon, authenticated;
grant execute on function
  app.hold_slot(uuid, uuid),
  app.release_hold(uuid, uuid),
  app.book_slot(uuid, uuid, text, uuid, public.reason_category, text, text, public.insurance_type, text, uuid),
  app.cancel_appointment(uuid, uuid),
  app.reschedule_appointment(uuid, uuid, uuid, text)
to service_role;
