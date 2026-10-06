/**
 * Erzeugt supabase/seed.sql aus dem deterministischen Seed-Generator (src/domain/seed),
 * damit App-Demo (InMemory) und Datenbank dieselben fiktiven Praxen/Ärzte haben.
 * Slots erzeugt die Datenbank selbst (app.demo_generate_slots) und rollt sie täglich.
 *
 * Aufruf: npm run seed:sql            (Stadt per DEMO_CITY=fulda|kassel|wuerzburg)
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveCity } from '../src/config/city';
import { SPECIALTIES } from '../src/domain/seed/catalog';
import { generateDirectory, SEED_VERSION } from '../src/domain/seed/generator';

const lit = (v: string | null | undefined) => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`);
const arr = (values: (string | number)[], type: 'text' | 'smallint') =>
  `array[${values.map((v) => (type === 'text' ? lit(String(v)) : String(v))).join(', ')}]::${type}[]`;
const json = (value: unknown) => `${lit(JSON.stringify(value))}::jsonb`;

export function buildSeedSql(cityId?: string): string {
  const city = resolveCity(cityId);
  const dir = generateDirectory(city);
  const out: string[] = [];
  out.push(
    `-- GENERIERT von scripts/generate-seed-sql.ts (${SEED_VERSION}, Stadt: ${city.name}). Nicht von Hand ändern.`,
  );
  out.push('-- Alle Praxen, Adressen, Ärztinnen/Ärzte und Termine sind FIKTIV (is_demo = true).');
  out.push('begin;');
  out.push("select set_config('app.skip_broadcast', 'on', true);");

  out.push('insert into public.specialties (id, slug, name_de, name_en, icon) values');
  out.push(
    SPECIALTIES.map(
      (s) => `  (${s.id}, ${lit(s.slug)}, ${lit(s.nameDe)}, ${lit(s.nameEn)}, ${lit(s.icon)})`,
    ).join(',\n') +
      '\non conflict (id) do update set slug = excluded.slug, name_de = excluded.name_de, name_en = excluded.name_en, icon = excluded.icon;',
  );

  out.push(
    'insert into public.practices (id, name, address, geo, phone, website, languages, accessibility, accepts_public, accepts_private, offers_video, opening_hours, services, rating_avg, rating_count, specialty_ids, is_demo, source, source_license) values',
  );
  out.push(
    dir.practices
      .map(
        (p) =>
          `  (${lit(p.id)}, ${lit(p.name)}, ${json({ street: p.address.street, postal_code: p.address.postalCode, city: p.address.city })}, ` +
          `extensions.st_setsrid(extensions.st_makepoint(${p.location.lng}, ${p.location.lat}), 4326)::extensions.geography, ` +
          `${lit(p.phone)}, ${lit(p.website)}, ${arr(p.languages, 'text')}, ${json(p.accessibility)}, ${p.acceptsPublic}, ${p.acceptsPrivate}, ` +
          `${p.offersVideo}, ${json(p.openingHours)}, ${arr(p.services, 'text')}, ${p.rating ? p.rating.average : 'null'}, ${p.rating ? p.rating.count : 0}, ` +
          `${arr(p.specialtyIds, 'smallint')}, true, 'seed', ${lit(p.sourceLicense)})`,
      )
      .join(',\n') + '\non conflict (id) do nothing;',
  );

  out.push('insert into public.doctors (id, practice_id, name, specialty_ids, languages) values');
  out.push(
    dir.doctors
      .map(
        (d) =>
          `  (${lit(d.id)}, ${lit(d.practiceId)}, ${lit(d.name)}, ${arr(d.specialtyIds, 'smallint')}, ${arr(d.languages, 'text')})`,
      )
      .join(',\n') + '\non conflict (id) do nothing;',
  );

  out.push(
    'insert into app.demo_doctor_profiles (doctor_id, slot_minutes, offer_rate, booked_rate) values',
  );
  out.push(
    dir.schedules
      .map((s) => `  (${lit(s.doctorId)}, ${s.slotMinutes}, ${s.offerRate}, ${s.bookedRate})`)
      .join(',\n') +
      '\non conflict (doctor_id) do update set slot_minutes = excluded.slot_minutes, offer_rate = excluded.offer_rate, booked_rate = excluded.booked_rate;',
  );

  out.push('insert into app.demo_sync_profiles (practice_id, sync_age_minutes) values');
  out.push(
    dir.sync.map((s) => `  (${lit(s.practiceId)}, ${s.syncAgeMinutes})`).join(',\n') +
      '\non conflict (practice_id) do update set sync_age_minutes = excluded.sync_age_minutes;',
  );

  out.push('select app.demo_generate_slots(14);');
  out.push('select app.demo_touch_sources();');
  out.push('commit;');
  return out.join('\n') + '\n';
}

if (require.main === module) {
  const target = join(__dirname, '..', 'supabase', 'seed.sql');
  writeFileSync(target, buildSeedSql(process.env.DEMO_CITY));
  console.log(`Seed geschrieben: ${target}`);
}
