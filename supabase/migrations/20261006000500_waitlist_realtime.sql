-- MedNow · Warteliste (FIFO, 10-Minuten-Reservierung), Realtime-Broadcast, Push-Outbox, Jobs.

-- Warteliste --------------------------------------------------------------------
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
  if p_days not in (3, 7, 14) or p_max_km not between 1 and 50 then
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

create or replace function app.leave_waitlist(p_user uuid, p_entry uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_offer record;
begin
  update public.waitlist_entries set status = 'cancelled' where id = p_entry and user_id = p_user and status = 'active';
  for v_offer in
    update public.waitlist_offers set status = 'declined'
     where entry_id = p_entry and status = 'pending'
    returning slot_id
  loop
    update public.availability_slots set status = 'open', held_until = null, held_by = null, hold_reason = null
     where id = v_offer.slot_id and status = 'held' and hold_reason = 'waitlist_offer';
  end loop;
end;
$$;

/*
 * Kern der Warteliste: Ein frei gewordener Slot geht an den ersten passenden,
 * aktiven Eintrag (FIFO nach Eintragszeit). Der Slot wird 10 Minuten reserviert,
 * eine datensparsame Push-Nachricht landet in der Outbox. Einträge, die für diesen
 * Slot schon ein Angebot hatten oder gerade ein anderes offenes Angebot haben,
 * werden übersprungen.
 */
create or replace function app.offer_slot_to_waitlist(p_slot uuid) returns uuid
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_now timestamptz := app.now();
  v_slot public.availability_slots;
  v_doctor public.doctors;
  v_practice public.practices;
  v_entry public.waitlist_entries;
  v_offer_id uuid;
begin
  if not exists (select 1 from public.waitlist_entries where status = 'active') then
    return null;
  end if;

  select * into v_slot from public.availability_slots where id = p_slot for update;
  if not found or v_slot.status <> 'open' or v_slot.starts_at <= v_now then
    return null;
  end if;
  select * into v_doctor from public.doctors where id = v_slot.doctor_id;
  select * into v_practice from public.practices where id = v_slot.practice_id;

  select e.* into v_entry
  from public.waitlist_entries e
  where e.status = 'active'
    and e.time_window @> v_slot.starts_at
    and (
      e.doctor_id = v_slot.doctor_id
      or e.practice_id = v_slot.practice_id
      or (e.specialty_id = any (v_doctor.specialty_ids)
          and st_dwithin(e.center, v_practice.geo, e.max_distance_km * 1000))
    )
    and not exists (select 1 from public.waitlist_offers o where o.entry_id = e.id and o.slot_id = v_slot.id)
    and not exists (select 1 from public.waitlist_offers o where o.user_id = e.user_id and o.status = 'pending')
    and not exists (
      select 1 from public.appointments a
      where a.slot_id = v_slot.id and a.user_id = e.user_id and a.cancelled_at > v_now - interval '1 hour'
    )
  order by e.created_at, e.id
  limit 1
  for update skip locked;

  if not found then
    return null;
  end if;

  update public.availability_slots
     set status = 'held', hold_reason = 'waitlist_offer', held_by = v_entry.user_id, held_until = v_now + interval '10 minutes'
   where id = v_slot.id;

  insert into public.waitlist_offers (entry_id, user_id, slot_id, offered_at, expires_at)
  values (v_entry.id, v_entry.user_id, v_slot.id, v_now, v_now + interval '10 minutes')
  returning id into v_offer_id;

  -- Datensparsam: nur die Angebots-ID, keine Praxis/Fachrichtung/Arzt (Sperrbildschirm!).
  insert into app.notification_outbox (user_id, kind, payload)
  values (v_entry.user_id, 'waitlist_offer', jsonb_build_object('offerId', v_offer_id));

  begin
    perform realtime.send(jsonb_build_object('offerId', v_offer_id), 'offer_created', 'offers:' || v_entry.user_id::text, true);
  exception when others then
    raise warning 'realtime.send fehlgeschlagen: %', sqlerrm;
  end;

  return v_offer_id;
end;
$$;

create or replace function app.respond_offer(
  p_user uuid,
  p_offer uuid,
  p_accept boolean,
  p_idempotency_key text,
  p_dependent uuid,
  p_reason public.reason_category,
  p_full_name text,
  p_phone text,
  p_insurance public.insurance_type,
  p_consent_version text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_offer public.waitlist_offers;
  v_result jsonb;
begin
  select * into v_offer from public.waitlist_offers where id = p_offer and user_id = p_user for update;
  if not found then
    perform app.raise_app_error('not_found');
  end if;
  if v_offer.status <> 'pending' or v_offer.expires_at <= app.now() then
    perform app.raise_app_error('offer_expired');
  end if;

  if not p_accept then
    update public.waitlist_offers set status = 'declined' where id = v_offer.id;
    -- Slot wird frei → Trigger bietet ihn der nächsten Person an.
    update public.availability_slots set status = 'open', held_until = null, held_by = null, hold_reason = null
     where id = v_offer.slot_id and status = 'held' and hold_reason = 'waitlist_offer';
    return null;
  end if;

  v_result := app.book_slot(p_user, v_offer.slot_id, p_idempotency_key, p_dependent, p_reason,
                            p_full_name, p_phone, p_insurance, p_consent_version, v_offer.id);
  update public.waitlist_offers set status = 'accepted' where id = v_offer.id;
  update public.waitlist_entries set status = 'fulfilled' where id = v_offer.entry_id;
  return v_result;
end;
$$;

-- Ablauf: abgelaufene Angebote → nächste Person; abgelaufene Checkout-Holds → frei.
create or replace function app.expire_holds_and_offers() returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_now timestamptz := app.now();
  v_offer record;
  v_count integer := 0;
begin
  for v_offer in
    update public.waitlist_offers set status = 'expired'
     where status = 'pending' and expires_at <= v_now
    returning slot_id
  loop
    update public.availability_slots set status = 'open', held_until = null, held_by = null, hold_reason = null
     where id = v_offer.slot_id and status = 'held' and hold_reason = 'waitlist_offer';
    v_count := v_count + 1;
  end loop;

  update public.availability_slots set status = 'open', held_until = null, held_by = null, hold_reason = null
   where status = 'held' and hold_reason = 'checkout' and held_until <= v_now;

  update public.waitlist_entries set status = 'expired'
   where status = 'active' and upper(time_window) <= v_now;
  return v_count;
end;
$$;

-- Trigger: Slot wird frei (Storno, Ablauf, neuer Slot) → Warteliste prüfen ---------
create or replace function app.on_slot_opened() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status = 'open' and (tg_op = 'INSERT' or old.status is distinct from 'open') then
    perform app.offer_slot_to_waitlist(new.id);
  end if;
  return null;
end;
$$;
create trigger slots_offer_waitlist
  after insert or update of status on public.availability_slots
  for each row execute function app.on_slot_opened();

-- Realtime-Broadcast je Geohash-5-Zelle (bereinigter Payload, ohne held_by) ---------
create or replace function app.broadcast_slot_change() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_cell text;
begin
  if current_setting('app.skip_broadcast', true) = 'on' then
    return null;
  end if;
  select geohash5 into v_cell from public.practices where id = new.practice_id;
  begin
    perform realtime.send(app.slot_json(new), 'slot_changed', 'slots:geo:' || v_cell, true);
  exception when others then
    raise warning 'realtime.send fehlgeschlagen: %', sqlerrm;
  end;
  return null;
end;
$$;
create trigger slots_broadcast
  after insert or update on public.availability_slots
  for each row execute function app.broadcast_slot_change();

-- Push-Outbox → Edge Function send_notifications (pg_net) ---------------------------
-- Benötigte Vault-Secrets: mednow_functions_url (z. B. https://<ref>.supabase.co/functions/v1)
-- und mednow_worker_secret (gemeinsames Geheimnis, auch als Edge-Function-Secret WORKER_SECRET).
create or replace function app.notify_push_worker() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from app.notification_outbox where sent_at is null and attempts < 5) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mednow_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'mednow_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/send_notifications',
    body := jsonb_build_object('trigger', 'outbox'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', v_secret)
  );
end;
$$;

create or replace function app.on_outbox_insert() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.notify_push_worker();
  return null;
end;
$$;
create trigger outbox_notify
  after insert on app.notification_outbox
  for each statement execute function app.on_outbox_insert();

-- Wird vom Worker (service_role) aufgerufen: holt offene Nachrichten mit Push-Tokens.
create or replace function app.claim_outbox(p_limit integer default 50) returns table (
  id bigint, user_id uuid, kind text, payload jsonb, tokens jsonb
)
language sql security definer
set search_path = public
as $$
  with claimed as (
    update app.notification_outbox o
       set attempts = o.attempts + 1
     where o.id in (
       select id from app.notification_outbox
        where sent_at is null and attempts < 5
        order by created_at
        limit p_limit
        for update skip locked
     )
    returning o.id, o.user_id, o.kind, o.payload
  )
  select c.id, c.user_id, c.kind, c.payload,
         coalesce(jsonb_agg(jsonb_build_object('token', t.token, 'locale', t.locale, 'formal', t.formal))
                  filter (where t.token is not null), '[]'::jsonb)
  from claimed c
  left join public.push_tokens t on t.user_id = c.user_id
  group by c.id, c.user_id, c.kind, c.payload
$$;

create or replace function app.mark_outbox(p_ids bigint[], p_error text default null) returns void
language sql security definer
set search_path = ''
as $$
  update app.notification_outbox
     set sent_at = case when p_error is null then app.now() else null end,
         last_error = p_error
   where id = any (p_ids);
$$;

revoke all on function
  app.join_waitlist(uuid, uuid, uuid, smallint, double precision, double precision, integer, integer),
  app.leave_waitlist(uuid, uuid),
  app.offer_slot_to_waitlist(uuid),
  app.respond_offer(uuid, uuid, boolean, text, uuid, public.reason_category, text, text, public.insurance_type, text),
  app.expire_holds_and_offers(),
  app.notify_push_worker(),
  app.claim_outbox(integer),
  app.mark_outbox(bigint[], text)
from public, anon, authenticated;
grant execute on function
  app.join_waitlist(uuid, uuid, uuid, smallint, double precision, double precision, integer, integer),
  app.leave_waitlist(uuid, uuid),
  app.respond_offer(uuid, uuid, boolean, text, uuid, public.reason_category, text, text, public.insurance_type, text),
  app.expire_holds_and_offers(),
  app.claim_outbox(integer),
  app.mark_outbox(bigint[], text)
to service_role;
grant select, insert, update on app.notification_outbox to service_role;
grant usage on sequence app.notification_outbox_id_seq to service_role;
