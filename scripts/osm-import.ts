/**
 * Praxisverzeichnis aus OpenStreetMap (© OpenStreetMap-Mitwirkende, ODbL 1.0).
 *
 * Lädt je Bundesland den OpenStreetMap-Auszug von Geofabrik, filtert Arzt-, Zahnarzt- und
 * Psychotherapiepraxen mit osmium (apt: osmium-tool), übernimmt nur Einträge mit Name, Adresse und
 * erkennbarer Fachrichtung und schreibt sie über die Management-API in app.import_osm_practices
 * (Migration 20261011000100). Termine werden nie erfunden – diese Praxen erscheinen in der App mit
 * „Keine Online-Termine – bitte anrufen“.
 *
 * Kein Overpass: Die öffentlichen Server lehnen Anfragen von geteilten CI-Adressen oft ab (504/500).
 *
 *   npx tsx scripts/osm-import.ts [--states HE,BY] [--apply] [--prune] [--out verzeichnis.json]
 *   npx tsx scripts/osm-import.ts --pbf auszug.osm.pbf      (lokale Datei, nur Probelauf)
 *
 * Ohne --apply: Probelauf (nur zählen). Mit --apply: SUPABASE_ACCESS_TOKEN und PROJECT_REF nötig.
 * --prune (nur zusammen mit allen Bundesländern): Einträge entfernen, die es nicht mehr gibt.
 */
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

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
  /** Nur Gebäude mit Adresse (zweiter Teil der Abfrage, „out geom“) */
  geometry?: { lat: number; lon: number }[];
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

export function isPractice(tags: Record<string, string> = {}): boolean {
  return (
    tags.amenity === 'doctors' ||
    tags.amenity === 'dentist' ||
    /^(doctor|dentist|psychotherapist)$/.test(tags.healthcare ?? '')
  );
}

const ADDRESS_KEYS = [
  'addr:street',
  'addr:place',
  'addr:housenumber',
  'addr:postcode',
  'addr:city',
];

function contains(ring: { lat: number; lon: number }[], lat: number, lon: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (
      a.lat > lat !== b.lat > lat &&
      lon < ((b.lon - a.lon) * (lat - a.lat)) / (b.lat - a.lat) + a.lon
    )
      inside = !inside;
  }
  return inside;
}

function boxArea(ring: { lat: number; lon: number }[]): number {
  const lats = ring.map((p) => p.lat);
  const lons = ring.map((p) => p.lon);
  return (Math.max(...lats) - Math.min(...lats)) * (Math.max(...lons) - Math.min(...lons));
}

/**
 * Viele Praxen sind als Punkt im Gebäude erfasst, die Adresse hängt am Gebäude. Dann übernehmen wir
 * die Adresse des Gebäudes, in dem der Punkt liegt (kleinstes, falls verschachtelt). Fehlt nur der
 * Ort, kommt er aus der Postleitzahl (häufigster Ort zu dieser PLZ in denselben Daten).
 */
export function enrichAddresses(elements: OsmElement[]) {
  const buildings = elements.filter(
    (el) =>
      el.type === 'way' && el.geometry && el.geometry.length >= 4 && el.tags?.['addr:housenumber'],
  );
  let fromBuilding = 0;
  let cityFromPostcode = 0;
  const practices = elements
    .filter((el) => isPractice(el.tags))
    .map((el) => {
      const tags = el.tags ?? {};
      if (
        el.type !== 'node' ||
        tags['addr:street'] ||
        tags['addr:place'] ||
        el.lat == null ||
        el.lon == null
      )
        return el;
      const building = buildings
        .filter((b) => contains(b.geometry!, el.lat!, el.lon!))
        .sort((a, b) => boxArea(a.geometry!) - boxArea(b.geometry!))[0];
      if (!building) return el;
      const merged = { ...tags };
      for (const key of ADDRESS_KEYS)
        if (!merged[key] && building.tags?.[key]) merged[key] = building.tags[key]!;
      fromBuilding++;
      return { ...el, tags: merged };
    });

  const votes = new Map<string, Map<string, number>>();
  for (const el of [...practices, ...buildings]) {
    const postcode = el.tags?.['addr:postcode']?.trim();
    const city = el.tags?.['addr:city']?.trim();
    if (!postcode || !city) continue;
    const forCode = votes.get(postcode) ?? new Map<string, number>();
    forCode.set(city, (forCode.get(city) ?? 0) + 1);
    votes.set(postcode, forCode);
  }
  const enriched = practices.map((el) => {
    const postcode = el.tags?.['addr:postcode']?.trim();
    if (!postcode || el.tags?.['addr:city']) return el;
    const best = [...(votes.get(postcode) ?? [])].sort((a, b) => b[1] - a[1])[0];
    if (!best) return el;
    cityFromPostcode++;
    return { ...el, tags: { ...el.tags, 'addr:city': best[0] } };
  });
  return { practices: enriched, fromBuilding, cityFromPostcode };
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
  const { practices, fromBuilding, cityFromPostcode } = enrichAddresses(elements);
  // Punkte zuerst: sie sitzen meist genau am Eingang
  const order = { node: 0, way: 1, relation: 2 } as const;
  for (const el of [...practices].sort((a, b) => order[a.type] - order[b.type] || a.id - b.id)) {
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
  return { rows, skipped, fromBuilding, cityFromPostcode, practices: practices.length };
}

// --- Abruf (Geofabrik + osmium) -------------------------------------------------------------------------

const GEOFABRIK: Record<string, string> = {
  BW: 'baden-wuerttemberg',
  BY: 'bayern',
  BE: 'berlin',
  BB: 'brandenburg',
  HB: 'bremen',
  HH: 'hamburg',
  HE: 'hessen',
  MV: 'mecklenburg-vorpommern',
  NI: 'niedersachsen',
  NW: 'nordrhein-westfalen',
  RP: 'rheinland-pfalz',
  SL: 'saarland',
  SN: 'sachsen',
  ST: 'sachsen-anhalt',
  SH: 'schleswig-holstein',
  TH: 'thueringen',
};

export const geofabrikUrl = (state: string) =>
  `https://download.geofabrik.de/europe/germany/${GEOFABRIK[state]}-latest.osm.pbf`;

export const PRACTICE_FILTERS = [
  'nwr/amenity=doctors,dentist',
  'nwr/healthcare=doctor,dentist,psychotherapist',
];

type Feature = {
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, string>;
};
type Ring = { lat: number; lon: number }[];

function outerRing(geometry: Feature['geometry']): Ring | null {
  if (!geometry) return null;
  const coords =
    geometry.type === 'Polygon'
      ? (geometry.coordinates as number[][][])[0]
      : geometry.type === 'MultiPolygon'
        ? (geometry.coordinates as number[][][][])[0]?.[0]
        : null;
  return coords ? coords.map(([lon, lat]) => ({ lat: lat!, lon: lon! })) : null;
}

/** Eine Zeile aus „osmium export -f geojsonseq -a type,id“ → OsmElement (Flächen mit Mittelpunkt). */
export function featureToElement(feature: Feature, withGeometry = false): OsmElement | null {
  const { '@type': type, '@id': id, ...tags } = feature.properties;
  if (type !== 'node' && type !== 'way' && type !== 'relation') return null;
  const el: OsmElement = { type, id: Number(id), tags };
  if (feature.geometry?.type === 'Point') {
    const [lon, lat] = feature.geometry.coordinates as number[];
    return { ...el, lat, lon };
  }
  const ring = outerRing(feature.geometry);
  if (!ring?.length) return null;
  const lats = ring.map((p) => p.lat);
  const lons = ring.map((p) => p.lon);
  el.center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
  };
  if (withGeometry) el.geometry = ring;
  return el;
}

function osmium(args: string[]) {
  execFileSync('osmium', args, { stdio: ['ignore', 'ignore', 'inherit'] });
}

/** Zeilenweise lesen, ohne die ganze Ausgabe im Speicher zu halten. */
async function eachFeature(args: string[], onFeature: (f: Feature) => void) {
  const child = spawn('osmium', args, { stdio: ['ignore', 'pipe', 'inherit'] });
  const lines = createInterface({ input: child.stdout });
  for await (const line of lines) {
    const json = line.replace(/^\x1e/, '').trim(); // geojsonseq: Datensatz-Trenner
    if (json) onFeature(JSON.parse(json) as Feature);
  }
  const code: number = await new Promise((resolve) => child.on('close', resolve));
  if (code !== 0) throw new Error(`osmium ${args[0]} endete mit ${code}`);
}

/**
 * Praxen und – nur für Praxis-Punkte ohne Adresse – die Gebäude mit Hausnummer, in denen sie liegen.
 * Gebäude werden über ein grobes Raster vorgefiltert, damit nicht Millionen im Speicher landen.
 */
export async function loadPbf(pbf: string, workDir: string): Promise<OsmElement[]> {
  const practicesPbf = join(workDir, 'praxen.osm.pbf');
  osmium(['tags-filter', pbf, ...PRACTICE_FILTERS, '-o', practicesPbf, '--overwrite']);
  const practices: OsmElement[] = [];
  await eachFeature(
    [
      'export',
      practicesPbf,
      '-f',
      'geojsonseq',
      '-a',
      'type,id',
      '--geometry-types=point,polygon',
      '-o',
      '-',
    ],
    (f) => {
      const el = featureToElement(f);
      if (el && isPractice(el.tags)) practices.push(el);
    },
  );

  const CELL = 0.005; // ≈ 550 m
  const cellKey = (lat: number, lon: number) =>
    `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;
  const grid = new Map<string, { lat: number; lon: number }[]>();
  for (const el of practices) {
    if (el.type !== 'node' || el.lat == null || el.lon == null) continue;
    if (el.tags?.['addr:street'] || el.tags?.['addr:place']) continue;
    const key = cellKey(el.lat, el.lon);
    grid.set(key, [...(grid.get(key) ?? []), { lat: el.lat, lon: el.lon }]);
  }
  if (!grid.size) return practices;

  const addressPbf = join(workDir, 'adressen.osm.pbf');
  osmium(['tags-filter', pbf, 'w/addr:housenumber', '-o', addressPbf, '--overwrite']);
  const buildings: OsmElement[] = [];
  await eachFeature(
    [
      'export',
      addressPbf,
      '-f',
      'geojsonseq',
      '-a',
      'type,id',
      '--geometry-types=polygon',
      '-o',
      '-',
    ],
    (f) => {
      const ring = outerRing(f.geometry);
      if (!ring?.length) return;
      const lats = ring.map((p) => p.lat);
      const lons = ring.map((p) => p.lon);
      const [minLat, maxLat, minLon, maxLon] = [
        Math.min(...lats),
        Math.max(...lats),
        Math.min(...lons),
        Math.max(...lons),
      ];
      // Gebäude sind klein: Zellen der Ecken genügen
      const keys = new Set([
        cellKey(minLat, minLon),
        cellKey(minLat, maxLon),
        cellKey(maxLat, minLon),
        cellKey(maxLat, maxLon),
      ]);
      const hit = [...keys].some((k) =>
        grid
          .get(k)
          ?.some((p) => p.lat >= minLat && p.lat <= maxLat && p.lon >= minLon && p.lon <= maxLon),
      );
      if (!hit) return;
      const el = featureToElement(f, true);
      if (el) buildings.push(el);
    },
  );
  return [...practices, ...buildings];
}

const USER_AGENT = 'Terminluecke-Verzeichnis/1.0 (github.com/benamarn100-gif/app)';

function download(url: string, file: string) {
  execFileSync(
    'curl',
    ['-fsSL', '--retry', '4', '--retry-delay', '20', '-A', USER_AGENT, '-o', file, url],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const complete = states.length === Object.keys(STATES).length && !opt('--pbf');
  if (prune && !complete) throw new Error('--prune nur zusammen mit allen Bundesländern');
  if (apply && opt('--pbf')) throw new Error('--pbf nur für Probeläufe');

  const seenAt = new Date().toISOString();
  summary(
    `## Praxisverzeichnis aus OpenStreetMap ${apply ? '' : '(Probelauf – nichts geschrieben)'}`,
  );
  summary('');
  summary(
    '| Land | OSM-Praxen | übernommen | Adresse vom Gebäude | Ort aus PLZ | ohne Fachrichtung | ohne Adresse | ohne Name | Duplikate | neu | aktualisiert | von Praxis gepflegt |',
  );
  summary('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  const all: ImportRow[] = [];
  const failed: string[] = [];
  const workDir = mkdtempSync(join(tmpdir(), 'osm-'));
  const localPbf = opt('--pbf');
  for (const state of localPbf ? ['lokal'] : states) {
    const label = STATES[state] ?? localPbf!;
    try {
      const pbf = localPbf ?? join(workDir, `${state}.osm.pbf`);
      if (!localPbf) download(geofabrikUrl(state), pbf);
      const elements = await loadPbf(pbf, workDir);
      if (!localPbf) rmSync(pbf, { force: true });
      const { rows, skipped, fromBuilding, cityFromPostcode, practices } = convert(elements);
      all.push(...rows);
      const t = apply ? await upload(rows, seenAt) : null;
      summary(
        `| ${label} | ${practices} | ${rows.length} | ${fromBuilding} | ${cityFromPostcode} | ${skipped.noSpecialty} | ${skipped.noAddress} | ${skipped.noName} | ${skipped.duplicate} | ${t?.inserted ?? '–'} | ${t?.updated ?? '–'} | ${t?.maintainedByPractice ?? '–'} |`,
      );
    } catch (e) {
      failed.push(state);
      summary(`| ${label} | Fehler: ${String(e).slice(0, 160)} | | | | | | | | | | |`);
    }
  }
  rmSync(workDir, { recursive: true, force: true });
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
