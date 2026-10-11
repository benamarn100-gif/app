-- Terminlücke · Echtes Praxisverzeichnis statt Demo.
--
--  - app.settings / app.show_demo(): Schalter für die erfundenen Demo-Praxen. Standard AUS – im
--    echten Betrieb sind Demo-Praxen, ihre Ärztinnen/Ärzte und Termine für die App unsichtbar
--    (RLS), nicht buchbar und die Demo-Jobs erzeugen nichts mehr. Die Tests schalten die Demo ein.
--  - Praxisverzeichnis aus OpenStreetMap (ODbL 1.0): app.import_osm_practices(jsonb) legt Praxen
--    ohne Termine an bzw. aktualisiert sie (Status „unbekannt“, Anrufen). Einträge, die eine Praxis
--    selbst pflegt, werden nie überschrieben. Ausschlussliste für Praxen, die nicht erscheinen
--    wollen; app.prune_osm_practices entfernt Einträge, die es in OpenStreetMap nicht mehr gibt.
--  - app.onboard_practice übernimmt einen vorhandenen Verzeichniseintrag (gleiche Adresse bzw.
--    gleicher Name in der Nähe) statt ihn zu verdoppeln – Merklisten und Alarme bleiben gültig.
-- Alles nur für den Betreiber (Management-API/service_role); Clients haben kein Ausführungsrecht.

-- Schalter ---------------------------------------------------------------------
create table app.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app.settings enable row level security;
revoke all on app.settings from public, anon, authenticated;
insert into app.settings (key, value) values ('show_demo', 'false') on conflict (key) do nothing;

create or replace function app.show_demo() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::boolean from app.settings where key = 'show_demo'), false)
$$;
revoke all on function app.show_demo() from public;
grant execute on function app.show_demo() to anon, authenticated, service_role;

-- Demo unsichtbar, solange der Schalter aus ist (gilt für alle Lese-Funktionen mit Aufruferrechten)
drop policy "Praxen öffentlich lesbar" on public.practices;
create policy "Praxen öffentlich lesbar" on public.practices for select to anon, authenticated
  using (not is_demo or (select app.show_demo()));

drop policy "Ärzte öffentlich lesbar" on public.doctors;
create policy "Ärzte öffentlich lesbar" on public.doctors for select to anon, authenticated
  using (exists (select 1 from public.practices p where p.id = doctors.practice_id));

drop policy "Slots öffentlich lesbar" on public.availability_slots;
create policy "Slots öffentlich lesbar" on public.availability_slots for select to anon, authenticated
  using (exists (select 1 from public.practices p where p.id = availability_slots.practice_id));

-- get_practice ist eine einfache SQL-Funktion mit Aufruferrechten: RLS greift, Demo → null.

-- Demo-Termine nicht reservierbar/buchbar, solange der Schalter aus ist
create or replace function app.guard_demo_slot() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status in ('held', 'booked') and old.status is distinct from new.status
     and not app.show_demo()
     and exists (select 1 from public.practices p where p.id = new.practice_id and p.is_demo) then
    perform app.raise_app_error('not_found');
  end if;
  return new;
end;
$$;
revoke all on function app.guard_demo_slot() from public, anon, authenticated;
create trigger slots_guard_demo before update of status on public.availability_slots
for each row execute function app.guard_demo_slot();

-- Demo-Jobs ruhen, solange der Schalter aus ist (alte Demo-Slots werden weiter aufgeräumt)
create or replace function app.demo_touch_sources() returns void
language sql security definer
set search_path = public
as $$
  insert into public.availability_sources (practice_id, provider, last_synced_at)
  select sp.practice_id, 'seed', app.now() - make_interval(mins => sp.sync_age_minutes)
  from app.demo_sync_profiles sp
  where app.show_demo()
  on conflict (practice_id, provider) do update set last_synced_at = excluded.last_synced_at;
$$;

create or replace function app.demo_roll_slots() returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  perform set_config('app.skip_broadcast', 'on', true);
  delete from public.availability_slots s
   using public.practices p
   where p.id = s.practice_id and p.is_demo
     and s.ends_at < app.now() - interval '1 day'
     and not exists (select 1 from public.appointments a where a.slot_id = s.id)
     and not exists (select 1 from public.waitlist_offers o where o.slot_id = s.id);
  if app.show_demo() then
    v_count := app.demo_generate_slots(14);
    perform app.demo_touch_sources();
  end if;
  return v_count;
end;
$$;
revoke all on function app.demo_touch_sources(), app.demo_roll_slots() from public, anon, authenticated;
grant execute on function app.demo_touch_sources(), app.demo_roll_slots() to service_role;

-- Verzeichnis --------------------------------------------------------------------
alter table public.practices
  add column external_ref text check (external_ref is null or external_ref ~ '^osm:(node|way|relation)/[0-9]+$'),
  add column directory_seen_at timestamptz;
create unique index practices_external_ref_idx on public.practices (external_ref) where external_ref is not null;
-- external_ref ist öffentlich (OpenStreetMap-Objekt). Keine Spaltenrechte: die Suche übergibt ganze
-- Zeilen an app.practice_json (siehe Migration 20261006001000).

create table app.directory_exclusions (
  external_ref text primary key,
  reason text not null check (char_length(reason) between 3 and 300),
  created_at timestamptz not null default now()
);
alter table app.directory_exclusions enable row level security;
revoke all on app.directory_exclusions from public, anon, authenticated;

-- Straßen vergleichbar machen: „Hauptstraße 5“ = „Hauptstr. 5“ = „hauptstrasse 5“
create or replace function app.norm_street(p text) returns text
language sql immutable
set search_path = ''
as $$
  select regexp_replace(regexp_replace(lower(coalesce(p, '')), 'stra(ß|ss)e', 'str', 'g'), '[^a-z0-9äöüß]', '', 'g')
$$;

-- Vorhandene Praxis, die zu diesen Angaben passt (gleiche Adresse und Fachrichtung oder gleicher
-- Name in der Nähe). p_sources: in welchen Quellen gesucht wird.
create or replace function app.find_matching_practice(
  p_name text,
  p_street text,
  p_postal text,
  p_geo extensions.geography,
  p_specialties smallint[],
  p_sources public.data_source[]
) returns uuid
language sql stable
set search_path = public, extensions
as $$
  select pr.id
    from public.practices pr
   where not pr.is_demo
     and pr.source = any (p_sources)
     and st_dwithin(pr.geo, p_geo, 300)
     and (
       lower(pr.name) = lower(p_name)
       or (pr.address ->> 'postal_code' = p_postal
           and app.norm_street(pr.address ->> 'street') = app.norm_street(p_street)
           and pr.specialty_ids && p_specialties)
     )
   order by (lower(pr.name) = lower(p_name)) desc, st_distance(pr.geo, p_geo), pr.created_at
   limit 1
$$;

create or replace function app.practice_json(p public.practices) returns jsonb
language sql stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'address', jsonb_build_object('street', p.address->>'street', 'postalCode', p.address->>'postal_code', 'city', p.address->>'city'),
    'location', jsonb_build_object('lat', st_y(p.geo::geometry), 'lng', st_x(p.geo::geometry)),
    'phone', p.phone,
    'website', p.website,
    'languages', to_jsonb(p.languages),
    'accessibility', p.accessibility,
    'acceptsPublic', p.accepts_public,
    'acceptsPrivate', p.accepts_private,
    'offersVideo', p.offers_video,
    'openingHours', p.opening_hours,
    'services', to_jsonb(p.services),
    'photoUrl', p.photo_url,
    'photoBlurhash', p.photo_blurhash,
    'rating', case when p.rating_avg is null then null
                   else jsonb_build_object('average', p.rating_avg, 'count', p.rating_count) end,
    'specialtyIds', to_jsonb(p.specialty_ids),
    'isDemo', p.is_demo,
    'source', p.source,
    'sourceLicense', p.source_license,
    -- Nur für OpenStreetMap-Einträge: dort kann jede Person falsche Angaben korrigieren
    'sourceUrl', case when p.source = 'osm' and p.external_ref is not null
                      then 'https://www.openstreetmap.org/' || substr(p.external_ref, 5) end,
    'verifiedAt', p.verified_at
  )
$$;

-- Import -------------------------------------------------------------------------
-- p_rows: [{ref: "node/123", name, street, postal_code, city, lat, lng, phone?, website?,
--           specialties: [slug…], languages?: [..], wheelchair?: bool, opening_hours?: {...},
--           private_only?: bool}]
-- Ungültige Zeilen werden gezählt und übersprungen, nie halb angelegt.
create or replace function app.import_osm_practices(p_rows jsonb, p_seen_at timestamptz default now()) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  r jsonb;
  v_ref text;
  v_name text;
  v_street text;
  v_postal text;
  v_city text;
  v_lat double precision;
  v_lng double precision;
  v_geo geography;
  v_website text;
  v_phone text;
  v_specialties smallint[];
  v_languages text[];
  v_hours jsonb;
  v_access jsonb;
  v_private boolean;
  v_new boolean;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_invalid integer := 0;
  v_excluded integer := 0;
  v_maintained integer := 0;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'invalid_input: Liste erwartet';
  end if;
  perform set_config('app.skip_broadcast', 'on', true);

  for r in select value from jsonb_array_elements(p_rows) loop
    v_ref := 'osm:' || (r ->> 'ref');
    v_name := left(btrim(r ->> 'name'), 120);
    v_street := btrim(r ->> 'street');
    v_postal := btrim(r ->> 'postal_code');
    v_city := btrim(r ->> 'city');
    -- Ohne Ausnahmeblock (je Zeile eine Subtransaktion): Zahlen nur, wenn es Zahlen sind
    v_lat := case when jsonb_typeof(r -> 'lat') = 'number' then (r ->> 'lat')::double precision end;
    v_lng := case when jsonb_typeof(r -> 'lng') = 'number' then (r ->> 'lng')::double precision end;

    if v_ref !~ '^osm:(node|way|relation)/[0-9]+$'
       or v_name is null or char_length(v_name) < 2
       or coalesce(v_street, '') = '' or coalesce(v_city, '') = '' or coalesce(v_postal, '') !~ '^\d{5}$'
       or v_lat is null or v_lng is null or v_lat not between 47.2 and 55.1 or v_lng not between 5.8 and 15.1 then
      v_invalid := v_invalid + 1;
      continue;
    end if;

    select coalesce(array_agg(distinct sp.id order by sp.id), '{}') into v_specialties
      from jsonb_array_elements_text(coalesce(r -> 'specialties', '[]')) s
      join public.specialties sp on sp.slug = s;
    if cardinality(v_specialties) = 0 then
      v_invalid := v_invalid + 1;
      continue;
    end if;

    if exists (select 1 from app.directory_exclusions e where e.external_ref = v_ref) then
      v_excluded := v_excluded + 1;
      continue;
    end if;

    v_geo := st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography;

    -- Pflegt die Praxis sich schon selbst (Pilot), bleibt ihr Eintrag maßgeblich
    if exists (select 1 from public.practices pr where pr.external_ref = v_ref and pr.source <> 'osm')
       or app.find_matching_practice(v_name, v_street, v_postal, v_geo, v_specialties,
                                     array['practice_dashboard', 'tss_116117']::public.data_source[]) is not null then
      v_maintained := v_maintained + 1;
      continue;
    end if;

    v_website := nullif(btrim(coalesce(r ->> 'website', '')), '');
    if v_website !~* '^https?://[^\s]+$' then v_website := null; end if;
    v_phone := left(nullif(btrim(coalesce(r ->> 'phone', '')), ''), 40);

    select coalesce(array_agg(distinct l order by l), '{de}') into v_languages
      from jsonb_array_elements_text(coalesce(r -> 'languages', '["de"]')) l where l ~ '^[a-z]{2}$';
    if not ('de' = any (v_languages)) then v_languages := array_prepend('de', v_languages); end if;

    v_hours := case when jsonb_typeof(r -> 'opening_hours') = 'object' then r -> 'opening_hours' else '{}' end;
    v_access := case jsonb_typeof(r -> 'wheelchair')
                  when 'boolean' then jsonb_build_object('wheelchair', (r -> 'wheelchair')::boolean)
                  else '{}' end;
    v_private := coalesce(jsonb_typeof(r -> 'private_only') = 'boolean' and (r -> 'private_only')::boolean, false);

    insert into public.practices as pr (name, address, geo, phone, website, languages, accessibility, accepts_public,
                                        accepts_private, opening_hours, specialty_ids, is_demo, source, source_license,
                                        external_ref, directory_seen_at)
    values (v_name, jsonb_build_object('street', v_street, 'postal_code', v_postal, 'city', v_city), v_geo,
            v_phone, v_website, v_languages, v_access, not v_private, true, v_hours, v_specialties, false, 'osm',
            '© OpenStreetMap-Mitwirkende, ODbL 1.0', v_ref, p_seen_at)
    on conflict (external_ref) where external_ref is not null do update
       set name = excluded.name, address = excluded.address, geo = excluded.geo, phone = excluded.phone,
           website = excluded.website, languages = excluded.languages, accessibility = excluded.accessibility,
           accepts_public = excluded.accepts_public, opening_hours = excluded.opening_hours,
           specialty_ids = excluded.specialty_ids, directory_seen_at = excluded.directory_seen_at
     where pr.source = 'osm'
    returning (xmax = 0) into v_new;

    if not found then
      v_maintained := v_maintained + 1;
    elsif v_new then
      v_inserted := v_inserted + 1;
    else
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'invalid', v_invalid,
                            'excluded', v_excluded, 'maintainedByPractice', v_maintained);
end;
$$;

-- Einträge entfernen, die beim letzten vollständigen Import nicht mehr dabei waren.
-- Schutz: bricht ab, wenn mehr als p_max_share der Verzeichnis-Praxen betroffen wären
-- (z. B. weil ein Import unvollständig war).
create or replace function app.prune_osm_practices(p_seen_before timestamptz, p_max_share numeric default 0.1) returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_total integer;
  v_stale integer;
begin
  select count(*), count(*) filter (where directory_seen_at is null or directory_seen_at < p_seen_before)
    into v_total, v_stale
    from public.practices where source = 'osm';
  if v_total = 0 or v_stale = 0 then
    return 0;
  end if;
  if v_stale > v_total * p_max_share then
    raise exception 'prune_refused: % von % Einträgen wären betroffen – Import unvollständig?', v_stale, v_total;
  end if;
  delete from public.practices pr
   where pr.source = 'osm' and (pr.directory_seen_at is null or pr.directory_seen_at < p_seen_before)
     and not exists (select 1 from public.appointments a where a.practice_id = pr.id);
  get diagnostics v_stale = row_count;
  return v_stale;
end;
$$;

-- Praxis möchte nicht im Verzeichnis stehen (oder Eintrag ist falsch): entfernen und nie wieder
-- importieren. Selbst gepflegte Praxen sind davon nicht betroffen.
create or replace function app.exclude_directory_entry(p_ref text, p_reason text) returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_ref text := case when p_ref like 'osm:%' then p_ref else 'osm:' || btrim(p_ref) end;
  v_deleted integer;
begin
  if v_ref !~ '^osm:(node|way|relation)/[0-9]+$' then
    raise exception 'invalid_input: Verweis wie node/123 oder way/456';
  end if;
  insert into app.directory_exclusions (external_ref, reason) values (v_ref, btrim(p_reason))
  on conflict (external_ref) do update set reason = excluded.reason;
  delete from public.practices pr
   where pr.external_ref = v_ref and pr.source = 'osm'
     and not exists (select 1 from public.appointments a where a.practice_id = pr.id);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function
  app.norm_street(text),
  app.find_matching_practice(text, text, text, extensions.geography, smallint[], public.data_source[]),
  app.import_osm_practices(jsonb, timestamptz),
  app.prune_osm_practices(timestamptz, numeric),
  app.exclude_directory_entry(text, text)
  from public, anon, authenticated;

-- Pilotpraxis anlegen: vorhandenen Verzeichniseintrag übernehmen ------------------
create or replace function app.onboard_practice(p jsonb) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_name text := btrim(p ->> 'name');
  v_street text := btrim(p ->> 'street');
  v_postal text := btrim(p ->> 'postal_code');
  v_city text := btrim(p ->> 'city');
  v_lat double precision := (p ->> 'lat')::double precision;
  v_lng double precision := (p ->> 'lng')::double precision;
  v_phone text := nullif(btrim(coalesce(p ->> 'phone', '')), '');
  v_website text := nullif(btrim(coalesce(p ->> 'website', '')), '');
  v_email text := lower(btrim(p ->> 'owner_email'));
  v_dry boolean := coalesce((p ->> 'dry_run')::boolean, false);
  v_slugs text[];
  v_unknown text[];
  v_specialties smallint[];
  v_doctors text[];
  v_languages text[];
  v_geo geography;
  v_claim uuid;
  v_claim_name text;
  v_practice uuid;
  v_user uuid;
  v_owner text;
begin
  if v_name is null or char_length(v_name) not between 2 and 120 then
    raise exception 'invalid_input: name (2–120 Zeichen)';
  end if;
  if v_street is null or v_city is null or v_postal !~ '^\d{5}$' then
    raise exception 'invalid_input: Adresse (Straße, fünfstellige PLZ, Ort)';
  end if;
  -- Grob Deutschland: verhindert vertauschte Breite/Länge
  if v_lat is null or v_lng is null or v_lat not between 47.2 and 55.1 or v_lng not between 5.8 and 15.1 then
    raise exception 'invalid_input: Koordinaten liegen nicht in Deutschland (Breite, Länge vertauscht?)';
  end if;
  if v_website is not null and v_website !~* '^https?://' then
    raise exception 'invalid_input: Website muss mit https:// beginnen';
  end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_input: owner_email';
  end if;

  select coalesce(array_agg(distinct lower(btrim(s))), '{}') into v_slugs
    from jsonb_array_elements_text(coalesce(p -> 'specialties', '[]')) s where btrim(s) <> '';
  if cardinality(v_slugs) = 0 then
    raise exception 'invalid_input: mindestens eine Fachrichtung';
  end if;
  select coalesce(array_agg(s), '{}') into v_unknown
    from unnest(v_slugs) s where not exists (select 1 from public.specialties sp where sp.slug = s);
  if cardinality(v_unknown) > 0 then
    raise exception 'invalid_input: unbekannte Fachrichtung(en) %', array_to_string(v_unknown, ', ');
  end if;
  select array_agg(sp.id order by sp.id) into v_specialties from public.specialties sp where sp.slug = any (v_slugs);

  select coalesce(array_agg(btrim(d) order by ord), '{}') into v_doctors
    from jsonb_array_elements_text(coalesce(p -> 'doctors', '[]')) with ordinality as x(d, ord) where btrim(d) <> '';
  if cardinality(v_doctors) not between 1 and 30
     or exists (select 1 from unnest(v_doctors) d where char_length(d) not between 2 and 120) then
    raise exception 'invalid_input: 1–30 Ärztinnen/Ärzte mit 2–120 Zeichen';
  end if;

  select coalesce(array_agg(distinct lower(btrim(l))), '{de}') into v_languages
    from jsonb_array_elements_text(coalesce(p -> 'languages', '["de"]')) l where btrim(l) <> '';
  if exists (select 1 from unnest(v_languages) l where l !~ '^[a-z]{2}$') then
    raise exception 'invalid_input: Sprachen als zweistellige Codes (de, en, tr …)';
  end if;

  if exists (select 1 from public.practices pr
              where not pr.is_demo and pr.source <> 'osm'
                and lower(pr.name) = lower(v_name) and pr.address ->> 'postal_code' = v_postal) then
    raise exception 'practice_exists: % (%) ist schon angelegt', v_name, v_postal;
  end if;

  v_geo := st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography;
  v_claim := app.find_matching_practice(v_name, v_street, v_postal, v_geo, v_specialties,
                                        array['osm']::public.data_source[]);
  select name into v_claim_name from public.practices where id = v_claim;

  if v_dry then
    return jsonb_build_object('dryRun', true, 'name', v_name, 'specialtyIds', to_jsonb(v_specialties),
      'doctors', to_jsonb(v_doctors), 'languages', to_jsonb(v_languages), 'ownerEmail', v_email,
      'claims', v_claim_name);
  end if;

  if v_claim is not null then
    -- Gleiche Praxis-ID: Merklisten und Termin-Alarme aus dem Verzeichnis gelten weiter.
    -- Öffnungszeiten und Barrierefreiheit bleiben, bis die Praxis sie selbst pflegt.
    update public.practices
       set name = v_name,
           address = jsonb_build_object('street', v_street, 'postal_code', v_postal, 'city', v_city),
           geo = v_geo, phone = coalesce(v_phone, phone), website = coalesce(v_website, website),
           languages = v_languages, specialty_ids = v_specialties, accepts_public = true,
           source = 'practice_dashboard', source_license = 'Praxisangaben'
     where id = v_claim
    returning id into v_practice;
  else
    insert into public.practices (name, address, geo, phone, website, languages, specialty_ids, is_demo, source, source_license)
    values (v_name, jsonb_build_object('street', v_street, 'postal_code', v_postal, 'city', v_city),
            v_geo, v_phone, v_website, v_languages, v_specialties, false, 'practice_dashboard', 'Praxisangaben')
    returning id into v_practice;
  end if;

  insert into public.doctors (practice_id, name, specialty_ids, languages)
  select v_practice, d, v_specialties, v_languages from unnest(v_doctors) d;

  select id into v_user from auth.users where lower(email) = v_email;
  if found then
    perform app.add_practice_member(v_practice, v_email, 'owner');
    v_owner := 'member';
  else
    insert into app.practice_invites (practice_id, email, role) values (v_practice, v_email, 'owner')
    on conflict (practice_id, lower(email)) do nothing;
    v_owner := 'invited';
  end if;

  return jsonb_build_object('practiceId', v_practice, 'name', v_name, 'doctors', cardinality(v_doctors),
    'specialtyIds', to_jsonb(v_specialties), 'owner', v_owner, 'claimed', v_claim_name);
end;
$$;
revoke all on function app.onboard_practice(jsonb) from public, anon, authenticated;

-- Nur der Betreiber schaltet um:
--   update app.settings set value = 'true', updated_at = now() where key = 'show_demo';
