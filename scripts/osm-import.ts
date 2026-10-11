/**
 * Praxisverzeichnis aus OpenStreetMap (© OpenStreetMap-Mitwirkende, ODbL 1.0).
 *
 * Holt Arzt-, Zahnarzt- und Psychotherapiepraxen je Bundesland über die Overpass-API, übernimmt nur
 * Einträge mit Name, Adresse und erkennbarer Fachrichtung und schreibt sie über die Management-API
 * in app.import_osm_practices (Migration 20261011000100). Termine werden nie erfunden – diese Praxen
 * erscheinen in der App mit „Keine aktuellen Termindaten – bitte anrufen“.
 *
 *   npx tsx scripts/osm-import.ts [--states HE,BY] [--apply] [--prune] [--out verzeichnis.json]
 *
 * Ohne --apply: Probelauf (nur zählen). Mit --apply: SUPABASE_ACCESS_TOKEN und PROJECT_REF nötig.
 * --prune (nur zusammen mit allen Bundesländern): Einträge entfernen, die es nicht mehr gibt.
 */
import { randomBytes } from 'node:crypto';
import { appendFileSync, writeFileSync } from 'node:fs';

import type { OpeningHours, Weekday } from '../src/domain/types';

export const STATES: Record<string, string> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
};

export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type ImportRow = {
  ref: string;
  name: string;
  street: string;
  postal_code: string;
  city: string;
  lat: number;
  lng: number;
  specialties: string[];
  phone?: string;
  website?: string;
  languages?: string[];
  wheelchair?: boolean;
  opening_hours?: OpeningHours;
  private_only?: boolean;
};

export type SkipReason = 'noName' | 'noAddress' | 'noSpecialty' | 'notPublic' | 'duplicate';

// --- Fachrichtungen ------------------------------------------------------------------------------

/** healthcare:speciality=* (OSM-Wiki) → Fachrichtungen der App. Nicht aufgeführte Werte zählen nicht. */
const SPECIALITY_MAP: Record<string, string[]> = {
  general: ['allgemeinmedizin'],
  family_medicine: ['allgemeinmedizin'],
  general_practice: ['allgemeinmedizin'],
  internal: ['innere-medizin'],
  cardiology: ['innere-medizin'],
  gastroenterology: ['innere-medizin'],
  pulmonology: ['innere-medizin'],
  pneumology: ['innere-medizin'],
  nephrology: ['innere-medizin'],
  rheumatology: ['innere-medizin'],
  endocrinology: ['innere-medizin'],
  diabetology: ['innere-medizin'],
  haematology: ['innere-medizin'],
  oncology: ['innere-medizin'],
  angiology: ['innere-medizin'],
  paediatrics: ['kinder-jugendmedizin'],
  pediatrics: ['kinder-jugendmedizin'],
  gynaecology: ['frauenheilkunde'],
  gynecology: ['frauenheilkunde'],
  obstetrics: ['frauenheilkunde'],
  otolaryngology: ['hno'],
  otorhinolaryngology: ['hno'],
  ophthalmology: ['augenheilkunde'],
  dermatology: ['dermatologie'],
  dermatovenereology: ['dermatologie'],
  venereology: ['dermatologie'],
  orthopaedics: ['orthopaedie'],
  orthopedics: ['orthopaedie'],
  trauma: ['orthopaedie'],
  traumatology: ['orthopaedie'],
  dentistry: ['zahnmedizin'],
  dental: ['zahnmedizin'],
  orthodontics: ['zahnmedizin'],
  oral_surgery: ['zahnmedizin'],
  neurology: ['neurologie'],
  neuropsychiatry: ['neurologie', 'psychiatrie-psychotherapie'],
  urology: ['urologie'],
  andrology: ['urologie'],
  psychiatry: ['psychiatrie-psychotherapie'],
  child_psychiatry: ['psychiatrie-psychotherapie'],
  psychotherapy: ['psychiatrie-psychotherapie'],
  psychosomatic: ['psychiatrie-psychotherapie'],
  psychosomatics: ['psychiatrie-psychotherapie'],
  behavioural: ['psychiatrie-psychotherapie'],
  depth_psychology: ['psychiatrie-psychotherapie'],
  psychoanalysis: ['psychiatrie-psychotherapie'],
};

/** Nur wenn keine Fachrichtung getaggt ist: eindeutige Wörter im Praxisnamen. */
const NAME_RULES: [RegExp, string[]][] = [
  [
    /hausarzt|hausärzt|allgemeinmedizin|allgemeinarzt|allgemeinärzt|familienmedizin/i,
    ['allgemeinmedizin'],
  ],
  [
    /internist|innere medizin|kardiolog|gastroenterolog|pneumolog|lungenarzt|lungenärzt|rheumatolog|diabetolog|nephrolog|onkolog|hämatolog|endokrinolog|angiolog/i,
    ['innere-medizin'],
  ],
  [
    /kinderarzt|kinderärzt|kinder- und jugendmedizin|kinderheilkunde|jugendmedizin|pädiat/i,
    ['kinder-jugendmedizin'],
  ],
  [/frauenarzt|frauenärzt|frauenheilkunde|gynäkolog|gynaekolog/i, ['frauenheilkunde']],
  [/\bhno\b|hals-?\s?nasen-?\s?ohren/i, ['hno']],
  [/augenarzt|augenärzt|augenheilkunde|augenpraxis|augenzentrum|ophthalmolog/i, ['augenheilkunde']],
  [/hautarzt|hautärzt|dermatolog|hautpraxis/i, ['dermatologie']],
  [/orthopäd|orthopaed|unfallchirurg/i, ['orthopaedie']],
  [/neurolog|nervenarzt|nervenärzt/i, ['neurologie']],
  [/urolog/i, ['urologie']],
  [/psychiatr|psychotherap|psychosomat|nervenarzt|nervenärzt/i, ['psychiatrie-psychotherapie']],
];

const DENTAL_NAME = /zahn|dental|kieferorthop|oralchirurg/i;

export function specialtiesFor(tags: Record<string, string>): string[] {
  const out = new Set<string>();
  if (tags.amenity === 'dentist' || tags.healthcare === 'dentist') out.add('zahnmedizin');
  if (tags.healthcare === 'psychotherapist') out.add('psychiatrie-psychotherapie');
  for (const raw of (tags['healthcare:speciality'] ?? '').split(';')) {
    for (const slug of SPECIALITY_MAP[raw.trim().toLowerCase()] ?? []) out.add(slug);
  }
  if (out.size) return [...out].sort();
  const name = tags.name ?? '';
  // „Kinderzahnarzt“ ist Zahnmedizin, nicht Kinderheilkunde
  if (DENTAL_NAME.test(name)) return ['zahnmedizin'];
  for (const [re, slugs] of NAME_RULES) if (re.test(name)) slugs.forEach((s) => out.add(s));
  return [...out].sort();
}

// --- Öffnungszeiten --------------------------------------------------------------------------------

const DAYS: Record<string, Weekday> = {
  Mo: 'mon',
  Tu: 'tue',
  We: 'wed',
  Th: 'thu',
  Fr: 'fri',
  Sa: 'sat',
  Su: 'sun',
};
const DAY_ORDER = Object.keys(DAYS);
const DAY_SEL =
  /^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?(,(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?)*$/;
const TIME_RANGE = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;

function expandDays(sel: string): Weekday[] | null {
  if (!DAY_SEL.test(sel)) return null;
  const days: Weekday[] = [];
  for (const part of sel.split(',')) {
    const [from, to] = part.split('-');
    const a = DAY_ORDER.indexOf(from!);
    const b = to ? DAY_ORDER.indexOf(to) : a;
    // Bereiche über das Wochenende (Sa-Mo) zulassen
    for (let i = a; ; i = (i + 1) % 7) {
      days.push(DAYS[DAY_ORDER[i]!]!);
      if (i === b) break;
    }
  }
  return days;
}

function parseTimes(sel: string): { open: string; close: string }[] | null {
  const out: { open: string; close: string }[] = [];
  for (const part of sel.split(',')) {
    const m = TIME_RANGE.exec(part.trim());
    if (!m) return null;
    const open = `${m[1]!.padStart(2, '0')}:${m[2]}`;
    const close = `${m[3]!.padStart(2, '0')}:${m[4]}`;
    if (+m[1]! > 23 || +m[3]! > 24 || +m[2]! > 59 || +m[4]! > 59 || close <= open) return null;
    out.push({ open, close });
  }
  return out;
}

/**
 * Einfache, eindeutige opening_hours-Angaben (Wochentage + Uhrzeiten) → Sprechzeiten der App.
 * Alles andere (Ferien, Monate, Kommentare, „nach Vereinbarung“ …) → null, damit die App
 * „Keine Angaben“ zeigt statt falscher Zeiten. „PH off“ wird ignoriert.
 */
export function parseOpeningHours(value: string | undefined): OpeningHours | null {
  if (!value) return null;
  const text = value
    .trim()
    .replace(/\s+/g, ' ')
    // „Mo, We 08:00-12:00“ → „Mo,We 08:00-12:00“ (nur zwischen Tagen, nicht nach Uhrzeiten)
    .replace(/(?<=[a-z]),\s+(?=(?:Mo|Tu|We|Th|Fr|Sa|Su)\b)/g, ',');
  if (
    !text ||
    /["|[\]+]|sunrise|sunset|week|easter|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(
      text,
    )
  )
    return null;
  const result: OpeningHours = {};
  const setByNormalRule = new Set<Weekday>();
  for (const rawRule of text.split(/\s*;\s*/)) {
    if (!rawRule) continue;
    // Zusatzregeln: „Mo-Fr 08:00-12:00, We 14:00-18:00“ – Komma nach einer Uhrzeit, dann Wochentag
    const parts = rawRule.split(/(?<=\d),\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)\b)/);
    for (const [index, rule] of parts.entries()) {
      const additive = index > 0;
      // Feiertage/Schulferien geschlossen: für die Wochenansicht ohne Bedeutung
      if (/^(?:PH|SH)(?:,(?:PH|SH))*(?: off| closed)$/.test(rule)) continue;
      const m = /^(?:(\S+) )?(.+)$/.exec(rule.trim());
      if (!m) return null;
      let daySel = m[1];
      let timeSel = m[2]!;
      // Nur Uhrzeiten ohne Tage → jeden Tag; Tage ohne Uhrzeit sind unklar
      if (!daySel && /^\d/.test(timeSel)) daySel = 'Mo-Su';
      if (!daySel) return null;
      const days = expandDays(daySel);
      if (!days) return null;
      timeSel = timeSel.trim();
      const periods = timeSel === 'off' || timeSel === 'closed' ? [] : parseTimes(timeSel);
      if (!periods) return null;
      for (const day of days) {
        if (additive) {
          result[day] = [...(result[day] ?? []), ...periods];
          continue;
        }
        // Eine spätere Regel ersetzt laut Spezifikation den ganzen Tag. Häufig ist aber „ergänzen“
        // gemeint („Mo-Fr 8-12; Mo,Di 15-18“) – bei solchen Widersprüchen lieber keine Angabe.
        if (setByNormalRule.has(day) && (result[day]?.length ?? 0) > 0 && periods.length > 0)
          return null;
        result[day] = periods;
        setByNormalRule.add(day);
      }
    }
  }
  for (const day of Object.keys(result) as Weekday[]) {
    const periods = result[day]!;
    if (!periods.length) {
      delete result[day];
      continue;
    }
    periods.sort((a, b) => a.open.localeCompare(b.open));
    for (let i = 1; i < periods.length; i++)
      if (periods[i]!.open < periods[i - 1]!.close) return null;
  }
  return Object.keys(result).length ? result : null;
}

// --- Zeile bauen -------------------------------------------------------------------------------------

const APP_LANGUAGES = new Set(['en', 'tr', 'ru', 'ar', 'pl', 'fr', 'es', 'uk']);

function firstValue(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    const first = v?.split(';')[0]?.trim();
    if (first) return first;
  }
  return undefined;
}

export function normalizeWebsite(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    if (!url.hostname.includes('.')) return undefined;
    return url.toString().slice(0, 300);
  } catch {
    return undefined;
  }
}

export function toRow(el: OsmElement): ImportRow | SkipReason {
  const tags = el.tags ?? {};
  if (tags.access === 'private' || tags.access === 'no') return 'notPublic';
  const name = tags.name?.trim();
  if (!name || name.length < 2) return 'noName';
  const streetName = (tags['addr:street'] ?? tags['addr:place'])?.trim();
  const postal = tags['addr:postcode']?.trim();
  const city = tags['addr:city']?.trim();
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!streetName || !postal || !/^\d{5}$/.test(postal) || !city || lat == null || lng == null)
    return 'noAddress';
  const specialties = specialtiesFor(tags);
  if (!specialties.length) return 'noSpecialty';

  const row: ImportRow = {
    ref: `${el.type}/${el.id}`,
    name: name.slice(0, 120),
    street: [streetName, tags['addr:housenumber']?.trim()].filter(Boolean).join(' '),
    postal_code: postal,
    city,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    specialties,
  };
  const phone = firstValue(tags.phone, tags['contact:phone']);
  if (phone) row.phone = phone.slice(0, 40);
  const website = normalizeWebsite(firstValue(tags.website, tags['contact:website'], tags.url));
  if (website) row.website = website;
  const languages = Object.entries(tags)
    .filter(([k, v]) => /^language:[a-z]{2}$/.test(k) && v === 'yes')
    .map(([k]) => k.slice(9))
    .filter((l) => APP_LANGUAGES.has(l));
  if (languages.length) row.languages = ['de', ...languages.sort()];
  if (tags.wheelchair === 'yes' || tags.wheelchair === 'designated') row.wheelchair = true;
  if (tags.wheelchair === 'no') row.wheelchair = false;
  const hours = parseOpeningHours(tags.opening_hours);
  if (hours) row.opening_hours = hours;
  if (/privatpraxis|nur privat/i.test(name) || tags['insurance:health'] === 'private')
    row.private_only = true;
  return row;
}

/** Dieselbe Praxis ist oft doppelt erfasst (Punkt + Gebäude): Name, PLZ und Straße gleich. */
export function convert(elements: OsmElement[]) {
  const rows: ImportRow[] = [];
  const skipped: Record<SkipReason, number> = {
    noName: 0,
    noAddress: 0,
    noSpecialty: 0,
    notPublic: 0,
    duplicate: 0,
  };
  const seen = new Set<string>();
  // Punkte zuerst: sie sitzen meist genau am Eingang
  const order = { node: 0, way: 1, relation: 2 } as const;
  for (const el of [...elements].sort((a, b) => order[a.type] - order[b.type] || a.id - b.id)) {
    const row = toRow(el);
    if (typeof row === 'string') {
      skipped[row]++;
      continue;
    }
    const key = [row.name.toLowerCase(), row.postal_code, row.street.toLowerCase()].join('|');
    if (seen.has(row.ref) || seen.has(key)) {
      skipped.duplicate++;
      continue;
    }
    seen.add(row.ref);
    seen.add(key);
    rows.push(row);
  }
  return { rows, skipped };
}

// --- Abruf und Upload ---------------------------------------------------------------------------------

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const USER_AGENT = 'Terminluecke-Verzeichnis/1.0 (github.com/benamarn100-gif/app)';

export function overpassQuery(state: string): string {
  return `[out:json][timeout:900];
area["ISO3166-2"="DE-${state}"]["boundary"="administrative"]->.a;
(
  nwr["amenity"="doctors"](area.a);
  nwr["amenity"="dentist"](area.a);
  nwr["healthcare"~"^(doctor|dentist|psychotherapist)$"](area.a);
);
out center tags;`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchState(state: string): Promise<OsmElement[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    const endpoint = OVERPASS[attempt % OVERPASS.length]!;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ data: overpassQuery(state) }),
        signal: AbortSignal.timeout(15 * 60_000),
      });
      if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
      if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(json.remark);
      if (!json.elements?.length) throw new Error(`${endpoint}: keine Einträge (unerwartet)`);
      return json.elements;
    } catch (e) {
      lastError = e;
      console.warn(`  ${state}: Versuch ${attempt + 1} fehlgeschlagen – ${String(e)}`);
      await sleep(30_000 * (attempt + 1));
    }
  }
  throw lastError;
}

async function runSql(sql: string): Promise<unknown> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.PROJECT_REF;
  if (!token || !ref) throw new Error('SUPABASE_ACCESS_TOKEN und PROJECT_REF fehlen');
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(120_000),
    });
    const body = await res.text();
    if (res.ok) return JSON.parse(body);
    // Ratenlimit oder kurzer Ausfall: noch einmal
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await sleep(5_000 * (attempt + 1));
      continue;
    }
    throw new Error(`Management-API ${res.status}: ${body.slice(0, 500)}`);
  }
}

/** JSON per zufälligem Dollar-Quoting einbetten – der Inhalt kann den SQL-Text nicht verlassen. */
export function jsonLiteral(value: unknown): string {
  const json = JSON.stringify(value);
  let tag: string;
  do tag = `osm${randomBytes(8).toString('hex')}`;
  while (json.includes(tag));
  return `$${tag}$${json}$${tag}$::jsonb`;
}

type Totals = {
  inserted: number;
  updated: number;
  invalid: number;
  excluded: number;
  maintainedByPractice: number;
};

async function upload(rows: ImportRow[], seenAt: string): Promise<Totals> {
  const totals: Totals = {
    inserted: 0,
    updated: 0,
    invalid: 0,
    excluded: 0,
    maintainedByPractice: 0,
  };
  const BATCH = 800;
  for (let i = 0; i < rows.length; i += BATCH) {
    const sql = `select app.import_osm_practices(${jsonLiteral(rows.slice(i, i + BATCH))}, '${seenAt}'::timestamptz) as r;`;
    const [{ r }] = (await runSql(sql)) as [{ r: Totals }];
    for (const k of Object.keys(totals) as (keyof Totals)[]) totals[k] += r[k];
  }
  return totals;
}

function summary(line: string) {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const apply = args.includes('--apply');
  const prune = args.includes('--prune');
  const out = opt('--out');
  const requested = (opt('--states') ?? '').toUpperCase().replace(/\s/g, '');
  const states = !requested || requested === 'ALLE' ? Object.keys(STATES) : requested.split(',');
  const unknown = states.filter((s) => !STATES[s]);
  if (unknown.length)
    throw new Error(`Unbekannte Bundesländer: ${unknown.join(', ')} (z. B. HE,BY,NW)`);
  const complete = states.length === Object.keys(STATES).length;
  if (prune && !complete) throw new Error('--prune nur zusammen mit allen Bundesländern');

  const seenAt = new Date().toISOString();
  summary(
    `## Praxisverzeichnis aus OpenStreetMap ${apply ? '' : '(Probelauf – nichts geschrieben)'}`,
  );
  summary('');
  summary(
    '| Land | OSM-Einträge | übernommen | ohne Fachrichtung | ohne Adresse | ohne Name | Duplikate | neu | aktualisiert | von Praxis gepflegt |',
  );
  summary('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  const all: ImportRow[] = [];
  const failed: string[] = [];
  for (const state of states) {
    try {
      const elements = await fetchState(state);
      const { rows, skipped } = convert(elements);
      all.push(...rows);
      const t = apply ? await upload(rows, seenAt) : null;
      summary(
        `| ${STATES[state]} | ${elements.length} | ${rows.length} | ${skipped.noSpecialty} | ${skipped.noAddress} | ${skipped.noName} | ${skipped.duplicate} | ${t?.inserted ?? '–'} | ${t?.updated ?? '–'} | ${t?.maintainedByPractice ?? '–'} |`,
      );
    } catch (e) {
      failed.push(state);
      summary(`| ${STATES[state]} | Fehler: ${String(e).slice(0, 160)} | | | | | | | | |`);
    }
    await sleep(5_000); // Overpass schonen
  }
  const bySpecialty = new Map<string, number>();
  for (const r of all)
    for (const s of r.specialties) bySpecialty.set(s, (bySpecialty.get(s) ?? 0) + 1);
  summary('');
  summary(
    `**Gesamt übernommen:** ${all.length} Praxen · mit Sprechzeiten: ${all.filter((r) => r.opening_hours).length} · mit Telefon: ${all.filter((r) => r.phone).length}`,
  );
  summary(
    `Fachrichtungen: ${[...bySpecialty]
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `${s} ${n}`)
      .join(' · ')}`,
  );
  if (out) writeFileSync(out, JSON.stringify(all));

  if (failed.length) {
    summary(
      `\n**Fehlgeschlagen:** ${failed.join(', ')} – erneut starten (nur diese: Eingabe „Bundesländer“).`,
    );
    process.exitCode = 1;
    return;
  }
  if (apply && prune) {
    const [{ n }] = (await runSql(
      `select app.prune_osm_practices('${seenAt}'::timestamptz) as n;`,
    )) as [{ n: number }];
    summary(`Nicht mehr in OpenStreetMap vorhanden und entfernt: ${n}`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
