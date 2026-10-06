-- MedNow · Verschlüsselung sensibler Felder und Row Level Security
--
-- Feldverschlüsselung: pgcrypto (AES-256) mit Schlüssel aus Supabase Vault
-- (Secret "mednow_field_key"). pgsodium/TCE ist bei Supabase „pending deprecation“.
-- Ent-/Verschlüsselung nur in security-definer-Funktionen; Clients sehen nie Schlüssel.

create or replace function app.field_key() returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  k text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'mednow_field_key' limit 1;
  if k is null or char_length(k) < 16 then
    raise exception 'field encryption key missing' using errcode = 'P0001', hint = 'Vault-Secret mednow_field_key anlegen';
  end if;
  return k;
end;
$$;

create or replace function app.encrypt(p_value text) returns bytea
language sql stable security definer
set search_path = ''
as $$
  select case when p_value is null then null
    else extensions.pgp_sym_encrypt(p_value, app.field_key(), 'cipher-algo=aes256, compress-algo=0') end
$$;

create or replace function app.decrypt(p_value bytea) returns text
language sql stable security definer
set search_path = ''
as $$
  select case when p_value is null then null else extensions.pgp_sym_decrypt(p_value, app.field_key()) end
$$;

revoke all on function app.field_key(), app.encrypt(text), app.decrypt(bytea) from public, anon, authenticated;

-- slots: updated_at automatisch
create trigger slots_touch before update on public.availability_slots for each row execute function app.touch_updated_at();

-- Row Level Security -----------------------------------------------------------
alter table public.specialties enable row level security;
alter table public.practices enable row level security;
alter table public.doctors enable row level security;
alter table public.availability_sources enable row level security;
alter table public.availability_slots enable row level security;
alter table public.profiles enable row level security;
alter table public.dependents enable row level security;
alter table public.appointments enable row level security;
alter table public.booking_contacts enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.waitlist_offers enable row level security;
alter table public.push_tokens enable row level security;
alter table public.consents enable row level security;
alter table app.notification_outbox enable row level security;

-- Öffentlich lesbar: Verzeichnis und Slots
create policy "Verzeichnis öffentlich lesbar" on public.specialties for select to anon, authenticated using (true);
create policy "Praxen öffentlich lesbar" on public.practices for select to anon, authenticated using (true);
create policy "Ärzte öffentlich lesbar" on public.doctors for select to anon, authenticated using (true);
create policy "Aktualität öffentlich lesbar" on public.availability_sources for select to anon, authenticated using (true);
create policy "Slots öffentlich lesbar" on public.availability_slots for select to anon, authenticated using (true);

-- Wer einen Slot hält, ist nicht öffentlich: Spaltenrechte statt ganzer Zeile.
revoke select on public.availability_slots from anon, authenticated;
grant select (id, doctor_id, practice_id, starts_at, ends_at, status, held_until, hold_reason, visit_type, source, updated_at)
  on public.availability_slots to anon, authenticated;

-- Nur eigene Zeilen
create policy "Eigenes Profil" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Eigene Familienmitglieder" on public.dependents for select to authenticated using (owner_id = (select auth.uid()));
create policy "Eigene Termine" on public.appointments for select to authenticated using (user_id = (select auth.uid()));
create policy "Eigene Buchungskontakte" on public.booking_contacts for select to authenticated using (
  exists (select 1 from public.appointments a where a.id = appointment_id and a.user_id = (select auth.uid()))
);
create policy "Eigene Wartelisten" on public.waitlist_entries for select to authenticated using (user_id = (select auth.uid()));
create policy "Eigene Angebote" on public.waitlist_offers for select to authenticated using (user_id = (select auth.uid()));
create policy "Eigene Push-Tokens" on public.push_tokens for select to authenticated using (user_id = (select auth.uid()));
create policy "Eigene Einwilligungen" on public.consents for select to authenticated using (user_id = (select auth.uid()));

-- Keine Schreib-Policies: Schreibzugriffe laufen ausschließlich über Edge Functions
-- (service_role) und die security-definer-Funktionen in "app".
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

-- Realtime: Clients dürfen Slot-Topics empfangen, aber nichts senden.
-- Auf gehosteten Projekten gehört realtime.messages Supabase und hat RLS bereits an;
-- nur lokal (eigener Superuser) muss sie eingeschaltet werden.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'realtime.messages'::regclass) then
    alter table realtime.messages enable row level security;
  end if;
end $$;
create policy "Slot-Änderungen empfangen" on realtime.messages for select to anon, authenticated
  using (realtime.messages.extension = 'broadcast' and realtime.topic() like 'slots:geo:%');
create policy "Eigene Angebote empfangen" on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and realtime.topic() = 'offers:' || (select auth.uid())::text);
