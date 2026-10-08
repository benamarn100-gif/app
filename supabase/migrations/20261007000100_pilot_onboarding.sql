-- Pilotpraxen anlegen, ohne SQL von Hand (GitHub-Workflow „Pilotpraxis anlegen“).
--
--  - app.onboard_practice(jsonb): legt eine echte Praxis (Quelle practice_dashboard, nie Demo)
--    mit Ärztinnen/Ärzten an und lädt die Praxis-E-Mail ein. Nur für den Betreiber
--    (Management-API/service_role) – Clients haben kein Ausführungsrecht.
--  - app.practice_invites: Einladung per E-Mail. Gibt es das Konto schon, wird die Person sofort
--    Mitglied; sonst, sobald sie sich mit dieser Adresse anmeldet und die Adresse bestätigt ist
--    (Trigger auf auth.users). Ohne Bestätigung kein Zugang – den Code bekommt nur, wer das
--    Postfach hat.

create table app.practice_invites (
  practice_id uuid not null references public.practices (id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.practice_role not null default 'owner',
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index practice_invites_email_idx on app.practice_invites (practice_id, lower(email));
alter table app.practice_invites enable row level security;
revoke all on app.practice_invites from public, anon, authenticated;

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
              where not pr.is_demo and lower(pr.name) = lower(v_name) and pr.address ->> 'postal_code' = v_postal) then
    raise exception 'practice_exists: % (%) ist schon angelegt', v_name, v_postal;
  end if;

  if v_dry then
    return jsonb_build_object('dryRun', true, 'name', v_name, 'specialtyIds', to_jsonb(v_specialties),
      'doctors', to_jsonb(v_doctors), 'languages', to_jsonb(v_languages), 'ownerEmail', v_email);
  end if;

  insert into public.practices (name, address, geo, phone, website, languages, specialty_ids, is_demo, source, source_license)
  values (v_name, jsonb_build_object('street', v_street, 'postal_code', v_postal, 'city', v_city),
          extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
          v_phone, v_website, v_languages, v_specialties, false, 'practice_dashboard', 'Praxisangaben')
  returning id into v_practice;

  insert into public.doctors (practice_id, name, specialty_ids, languages)
  select v_practice, d, v_specialties, v_languages from unnest(v_doctors) d;

  select id into v_user from auth.users where lower(email) = v_email;
  if found then
    perform app.add_practice_member(v_practice, v_email, 'owner');
    v_owner := 'member';
  else
    insert into app.practice_invites (practice_id, email, role) values (v_practice, v_email, 'owner');
    v_owner := 'invited';
  end if;

  return jsonb_build_object('practiceId', v_practice, 'name', v_name, 'doctors', cardinality(v_doctors),
    'specialtyIds', to_jsonb(v_specialties), 'owner', v_owner);
end;
$$;
revoke all on function app.onboard_practice(jsonb) from public, anon, authenticated;

-- Einladungen einlösen, sobald eine bestätigte Adresse zu einer Einladung passt.
-- Darf die Anmeldung nie blockieren: Fehler werden nur protokolliert.
create or replace function app.accept_practice_invites() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select i.practice_id, i.role from app.practice_invites i
     where lower(i.email) = lower(new.email) and i.accepted_at is null
  loop
    insert into public.practice_members (practice_id, user_id, role) values (r.practice_id, new.id, r.role)
    on conflict (practice_id, user_id) do update set role = excluded.role;
    update public.practices set verified_at = coalesce(verified_at, app.now()) where id = r.practice_id;
    update app.practice_invites set accepted_at = now()
     where practice_id = r.practice_id and lower(email) = lower(new.email);
  end loop;
  return new;
exception when others then
  raise warning 'accept_practice_invites: %', sqlerrm;
  return new;
end;
$$;
revoke all on function app.accept_practice_invites() from public, anon, authenticated;

create trigger accept_practice_invites
after insert or update of email, email_confirmed_at on auth.users
for each row when (new.email is not null and new.email_confirmed_at is not null)
execute function app.accept_practice_invites();
