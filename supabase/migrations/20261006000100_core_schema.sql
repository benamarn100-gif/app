-- MedNow · Kernschema
-- Zeiten in UTC (timestamptz), Anzeige in Europe/Berlin. Geo über PostGIS (geography, SRID 4326).

create extension if not exists postgis with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Interne Objekte liegen in "app" (nicht über die REST-API erreichbar).
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to service_role;

-- Testbare Uhr: in Tests per `set app.now = '…'` überschreibbar, sonst now().
create or replace function app.now() returns timestamptz
language sql stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('app.now', true), '')::timestamptz, now())
$$;
grant execute on function app.now() to anon, authenticated, service_role;

-- Typen ----------------------------------------------------------------------
create type public.slot_status as enum ('open', 'held', 'booked', 'cancelled');
create type public.hold_reason as enum ('checkout', 'waitlist_offer');
create type public.visit_type as enum ('in_person', 'video');
create type public.age_group as enum ('child_0_5', 'child_6_12', 'teen_13_17', 'adult_18_39', 'adult_40_64', 'senior_65_plus');
create type public.appointment_status as enum ('confirmed', 'cancelled', 'completed');
create type public.reason_category as enum ('acute', 'checkup', 'follow_up', 'prescription', 'vaccination', 'certificate', 'other');
create type public.waitlist_status as enum ('active', 'fulfilled', 'cancelled', 'expired');
create type public.offer_status as enum ('pending', 'accepted', 'expired', 'declined');
create type public.consent_type as enum ('health_data', 'terms', 'privacy', 'push', 'crash_reports', 'analytics');
create type public.insurance_type as enum ('public', 'private');
create type public.data_source as enum ('seed', 'practice_dashboard', 'osm', 'tss_116117');

-- Verzeichnis (öffentlich lesbar) -----------------------------------------------
create table public.specialties (
  id smallint primary key,
  slug text not null unique,
  name_de text not null,
  name_en text not null,
  icon text not null
);

create table public.practices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  address jsonb not null check (address ? 'street' and address ? 'postal_code' and address ? 'city'),
  geo extensions.geography(point, 4326) not null,
  geohash5 text generated always as (extensions.st_geohash(geo::extensions.geometry, 5)) stored,
  phone text,
  website text,
  languages text[] not null default '{de}',
  accessibility jsonb not null default '{}',
  accepts_public boolean not null default true,
  accepts_private boolean not null default true,
  offers_video boolean not null default false,
  opening_hours jsonb not null default '{}',
  services text[] not null default '{}',
  photo_url text,
  photo_blurhash text,
  rating_avg numeric(2, 1) check (rating_avg between 1 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  specialty_ids smallint[] not null default '{}',
  is_demo boolean not null default false,
  source public.data_source not null,
  source_license text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index practices_geo_idx on public.practices using gist (geo);
create index practices_geohash_idx on public.practices (geohash5);
create index practices_specialties_idx on public.practices using gin (specialty_ids);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  specialty_ids smallint[] not null default '{}',
  languages text[] not null default '{de}',
  photo_url text,
  created_at timestamptz not null default now(),
  unique (id, practice_id)
);
create index doctors_practice_idx on public.doctors (practice_id);

-- Aktualität je Praxis und Quelle → „Aktualisiert vor X Min.“ / Status „Unbekannt“ (> 24 h)
create table public.availability_sources (
  practice_id uuid not null references public.practices (id) on delete cascade,
  provider public.data_source not null,
  last_synced_at timestamptz not null,
  primary key (practice_id, provider)
);

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  practice_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.slot_status not null default 'open',
  held_until timestamptz,
  held_by uuid,
  hold_reason public.hold_reason,
  visit_type public.visit_type not null default 'in_person',
  source public.data_source not null,
  external_ref text,
  updated_at timestamptz not null default now(),
  foreign key (doctor_id, practice_id) references public.doctors (id, practice_id) on delete cascade,
  constraint slot_duration check (ends_at > starts_at and ends_at - starts_at <= interval '4 hours'),
  constraint slot_hold_consistency check (
    (status = 'held') = (held_until is not null and hold_reason is not null and held_by is not null)
  ),
  -- Keine Überschneidung je Arzt (stornierte Slots ausgenommen)
  constraint slots_no_overlap exclude using gist (
    doctor_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled')
);
create index slots_open_by_doctor_idx on public.availability_slots (doctor_id, starts_at) where status = 'open';
create index slots_practice_time_idx on public.availability_slots (practice_id, starts_at);
create index slots_held_until_idx on public.availability_slots (held_until) where status = 'held';

-- Nutzerdaten (nur eigene Zeilen lesbar) ----------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  age_group public.age_group,
  home_geo extensions.geography(point, 4326),
  home_label text check (char_length(home_label) <= 40),
  radius_km smallint not null default 10 check (radius_km between 1 and 50),
  preferred_specialties smallint[] not null default '{}',
  formal_address boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dependents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  label_enc bytea not null,
  age_group public.age_group not null,
  created_at timestamptz not null default now()
);
create index dependents_owner_idx on public.dependents (owner_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dependent_id uuid references public.dependents (id) on delete set null,
  slot_id uuid not null references public.availability_slots (id) on delete restrict,
  practice_id uuid not null references public.practices (id) on delete restrict,
  doctor_id uuid not null references public.doctors (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  visit_type public.visit_type not null,
  reason_category_enc bytea,
  status public.appointment_status not null default 'confirmed',
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 80),
  rescheduled_from uuid references public.appointments (id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
-- Genau eine aktive Buchung pro Slot. Partiell (statt plain unique), damit ein
-- stornierter Slot erneut gebucht werden kann (docs/decisions.md D-12).
create unique index appointments_one_active_per_slot on public.appointments (slot_id) where status = 'confirmed';
create unique index appointments_idempotency_idx on public.appointments (user_id, idempotency_key);
create index appointments_user_idx on public.appointments (user_id, starts_at);
create index appointments_practice_idx on public.appointments (practice_id, starts_at);

-- Kontaktdaten für die Praxis – verschlüsselt (pgcrypto + Vault-Schlüssel)
create table public.booking_contacts (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  full_name_enc bytea not null,
  phone_enc bytea not null,
  insurance public.insurance_type not null
);

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dependent_id uuid references public.dependents (id) on delete set null,
  doctor_id uuid references public.doctors (id) on delete cascade,
  practice_id uuid references public.practices (id) on delete cascade,
  specialty_id smallint references public.specialties (id),
  center extensions.geography(point, 4326),
  time_window tstzrange not null,
  max_distance_km smallint not null default 10 check (max_distance_km between 1 and 50),
  status public.waitlist_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint waitlist_single_target check (num_nonnulls(doctor_id, practice_id, specialty_id) = 1),
  constraint waitlist_specialty_center check (specialty_id is null or center is not null)
);
create index waitlist_active_fifo_idx on public.waitlist_entries (created_at, id) where status = 'active';
create index waitlist_user_idx on public.waitlist_entries (user_id);

create table public.waitlist_offers (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.waitlist_entries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot_id uuid not null references public.availability_slots (id) on delete cascade,
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status public.offer_status not null default 'pending',
  unique (entry_id, slot_id)
);
create unique index offers_one_pending_per_slot on public.waitlist_offers (slot_id) where status = 'pending';
create index offers_pending_expiry_idx on public.waitlist_offers (expires_at) where status = 'pending';
create index offers_user_idx on public.waitlist_offers (user_id);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  -- Für lokalisierte, datensparsame Push-Texte (Sprache, du/Sie)
  locale text not null default 'de' check (locale in ('de', 'en')),
  formal boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.consent_type not null,
  version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index consents_user_idx on public.consents (user_id, type);

-- Push-Outbox (intern). Payload enthält nie Arzt, Praxis oder Fachrichtung.
create table app.notification_outbox (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index outbox_pending_idx on app.notification_outbox (created_at) where sent_at is null;

-- updated_at pflegen
create or replace function app.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := app.now();
  return new;
end;
$$;
create trigger practices_touch before update on public.practices for each row execute function app.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function app.touch_updated_at();
