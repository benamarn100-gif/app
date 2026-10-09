import { addDays } from 'date-fns/addDays';

import type { CityConfig } from '../../config/city';
import { destinationPoint } from '../geo/distance';
import { berlinDateTime, berlinWeekday, startOfBerlinDay, toBerlin } from '../time/berlin';
import {
  ACCESSIBILITY_FEATURES,
  WEEKDAYS,
  type Doctor,
  type OpeningHours,
  type Practice,
  type PracticeAccessibility,
  type Slot,
  type SpecialtySlug,
  type Weekday,
} from '../types';
import {
  DEMO_PHONE_PREFIX,
  EXTRA_LANGUAGES,
  FIRST_NAMES,
  LAST_NAMES,
  PLACE_NAMES,
  PRACTICE_MIX,
  PRACTICE_PREFIX,
  SERVICES_BY_SPECIALTY,
  SLOT_MINUTES,
  SPECIALTIES,
  STREET_SUFFIX,
} from './catalog';
import { createRandom, hashString, mix32, uuidFromString, type Random } from './random';

/**
 * Deterministischer Generator für fiktive Demo-Daten.
 * Gleicher Seed + gleiche Stadt → identische Praxen/Ärzte (IDs stabil),
 * damit App-Demo (InMemory) und Supabase-Seed übereinstimmen.
 */

export const SEED_VERSION = 'mednow-demo-v1';
export const DEMO_SOURCE_LICENSE = 'Fiktive Demo-Daten (Terminlücke), frei verwendbar';

export type Busyness = 'busy' | 'normal' | 'relaxed';

export type DoctorScheduleProfile = {
  doctorId: string;
  slotMinutes: number;
  /** Anteil der Sprechzeit, der online buchbar angeboten wird. */
  offerRate: number;
  /** Wahrscheinlichkeit, dass ein angebotener Slot bereits gebucht ist. */
  bookedRate: number;
};

export type PracticeSyncProfile = {
  practiceId: string;
  /** Minuten seit letztem Abgleich (Demo). > 24 h → Status „Unbekannt“. */
  syncAgeMinutes: number;
};

export type DemoDirectory = {
  practices: Practice[];
  doctors: Doctor[];
  schedules: DoctorScheduleProfile[];
  sync: PracticeSyncProfile[];
};

const BOOKED_RATE: Record<Busyness, number> = { busy: 0.97, normal: 0.78, relaxed: 0.5 };

export function generateDirectory(city: CityConfig, seed: string = SEED_VERSION): DemoDirectory {
  const rnd = createRandom(`${seed}:${city.id}`);
  const places = rnd.shuffle(PLACE_NAMES);
  const practices: Practice[] = [];
  const doctors: Doctor[] = [];
  const schedules: DoctorScheduleProfile[] = [];
  const sync: PracticeSyncProfile[] = [];
  const usedNames = new Set<string>();
  let index = 0;

  for (const [slug, count] of PRACTICE_MIX) {
    const specialty = SPECIALTIES.find((s) => s.slug === slug);
    if (!specialty) throw new Error(`Fachrichtung fehlt: ${slug}`);
    for (let n = 0; n < count; n++) {
      const place = places[index % places.length] ?? 'Lindenhof';
      const practiceId = uuidFromString(`${seed}:${city.id}:practice:${index}`);
      const location = destinationPoint(
        city.center,
        // Dichter in der Innenstadt: Wurzel-Verteilung über die Fläche
        Math.sqrt(rnd.next()) * city.spreadKm * 1000,
        rnd.float(0, 360),
      );
      const busyness: Busyness = rnd.chance(0.22)
        ? 'busy'
        : rnd.chance(0.35)
          ? 'relaxed'
          : 'normal';
      const extraSpecialty =
        slug === 'allgemeinmedizin' && rnd.chance(0.25)
          ? [2]
          : slug === 'innere-medizin' && rnd.chance(0.4)
            ? [1]
            : [];
      const languages = ['de', ...EXTRA_LANGUAGES.filter(([, p]) => rnd.chance(p)).map(([l]) => l)];
      const name = uniqueName(
        `${rnd.pick(PRACTICE_PREFIX[slug])} ${connector(place)}${place}`,
        usedNames,
      );
      const offersVideo =
        slug === 'psychiatrie-psychotherapie' || rnd.chance(slug === 'dermatologie' ? 0.5 : 0.2);
      const privateOnly = rnd.chance(0.05);

      practices.push({
        id: practiceId,
        name,
        address: {
          street: `${place}${rnd.pick(STREET_SUFFIX)} ${rnd.int(1, 48)}`,
          postalCode: rnd.pick(city.postalCodes),
          city: city.name,
        },
        location: { lat: round6(location.lat), lng: round6(location.lng) },
        phone: `${DEMO_PHONE_PREFIX}${String(100 + index).padStart(3, '0')}`,
        website: null,
        languages,
        accessibility: accessibility(rnd),
        acceptsPublic: !privateOnly,
        acceptsPrivate: true,
        offersVideo,
        openingHours: openingHours(rnd, slug),
        services: [
          ...SERVICES_BY_SPECIALTY[slug],
          ...(offersVideo ? (['video_consultation'] as const) : []),
        ].filter((v, i, all) => all.indexOf(v) === i),
        photoUrl: null,
        photoBlurhash: null,
        rating: rnd.chance(0.75)
          ? { average: Math.round(rnd.float(3.6, 4.9) * 10) / 10, count: rnd.int(6, 180) }
          : null,
        specialtyIds: [specialty.id, ...extraSpecialty],
        isDemo: true,
        source: 'seed',
        sourceLicense: DEMO_SOURCE_LICENSE,
        verifiedAt: null,
      });

      const doctorCount = slug === 'allgemeinmedizin' ? rnd.int(1, 3) : rnd.int(1, 2);
      for (let d = 0; d < doctorCount; d++) {
        const doctorId = uuidFromString(`${seed}:${city.id}:doctor:${index}:${d}`);
        doctors.push({
          id: doctorId,
          practiceId,
          name: `${rnd.chance(0.85) ? 'Dr. med. ' : ''}${rnd.pick(FIRST_NAMES)} ${rnd.pick(LAST_NAMES)}`,
          specialtyIds: [specialty.id],
          languages: languages.filter((l) => l === 'de' || rnd.chance(0.7)),
          photoUrl: null,
        });
        schedules.push({
          doctorId,
          slotMinutes: SLOT_MINUTES[slug],
          offerRate: Math.round(rnd.float(0.25, 0.45) * 100) / 100,
          bookedRate: BOOKED_RATE[busyness],
        });
      }

      // ~7 % der Praxen haben veraltete Daten (> 24 h) → Status „Unbekannt“
      const stale = rnd.chance(0.07);
      sync.push({ practiceId, syncAgeMinutes: stale ? rnd.int(26 * 60, 72 * 60) : rnd.int(2, 55) });
      index++;
    }
  }
  return { practices, doctors, schedules, sync };
}

function connector(place: string): string {
  if (/^(Am|An|Im|Auf)\s/.test(place)) return '';
  return /hof|park|platz|garten|weg|feld|grund|hain|hang|bach|blick|rand/i.test(place) ? 'am ' : '';
}

function uniqueName(name: string, used: Set<string>): string {
  let candidate = name;
  let i = 2;
  while (used.has(candidate)) candidate = `${name} ${i++}`;
  used.add(candidate);
  return candidate;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function accessibility(rnd: Random): PracticeAccessibility {
  const stepFree = rnd.chance(0.6);
  const result = Object.fromEntries(
    ACCESSIBILITY_FEATURES.map((f) => [f, false]),
  ) as PracticeAccessibility;
  result.stepFree = stepFree;
  result.wheelchair = stepFree && rnd.chance(0.75);
  result.elevator = rnd.chance(0.45);
  result.accessibleToilet = result.wheelchair && rnd.chance(0.6);
  result.parking = rnd.chance(0.5);
  result.hearingLoop = rnd.chance(0.08);
  return result;
}

function openingHours(rnd: Random, slug: SpecialtySlug): OpeningHours {
  const hours: OpeningHours = {};
  const morning = {
    open: rnd.pick(['07:30', '08:00', '08:00', '08:30']),
    close: rnd.pick(['12:00', '12:30', '13:00']),
  };
  const afternoon = {
    open: rnd.pick(['14:00', '14:30', '15:00']),
    close: rnd.pick(['17:30', '18:00', '18:00']),
  };
  const lateDay: Weekday = rnd.pick(['tue', 'thu']);
  const hasEvening = rnd.chance(0.3);
  for (const day of WEEKDAYS) {
    if (day === 'sun') continue;
    if (day === 'sat') {
      if (slug === 'zahnmedizin' ? rnd.chance(0.3) : rnd.chance(0.1))
        hours.sat = [{ open: '09:00', close: '12:00' }];
      continue;
    }
    const slots = [morning];
    if (day === 'mon' || day === 'tue' || day === 'thu') {
      slots.push(
        hasEvening && day === lateDay ? { open: afternoon.open, close: '20:00' } : afternoon,
      );
    } else if (day === 'wed' && rnd.chance(0.3)) {
      slots.push({ open: '14:00', close: '16:00' });
    }
    hours[day] = slots;
  }
  return hours;
}

const WEEKDAY_BY_JS_DAY: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Slots für `days` Tage ab heute (Berlin). Die Zufallsentscheidungen hängen nur an
 * Arzt-ID + Startzeit (Hash), nicht an der Reihenfolge – dadurch bleibt ein Slot
 * stabil, wenn das Fenster weiterrollt.
 */
export function generateSlots(directory: DemoDirectory, now: Date, days = 14): Slot[] {
  const practiceById = new Map(directory.practices.map((p) => [p.id, p]));
  const doctorById = new Map(directory.doctors.map((d) => [d.id, d]));
  const slots: Slot[] = [];
  const today = startOfBerlinDay(now);
  const updatedAt = now.toISOString();
  // Zeitzonen-Rechnungen sind teuer (Intl) – je Tag und Uhrzeit nur einmal ausführen.
  const days_ = Array.from({ length: days }, (_, offset) => {
    const day = addDays(toBerlin(today), offset);
    return { offset, day, weekday: WEEKDAY_BY_JS_DAY[berlinWeekday(day)] as Weekday };
  });
  const timeCache = new Map<string, number>();
  const at = (offset: number, day: Date, hhmm: string) => {
    const key = `${offset}:${hhmm}`;
    let value = timeCache.get(key);
    if (value === undefined) {
      value = berlinDateTime(day, hhmm).getTime();
      timeCache.set(key, value);
    }
    return value;
  };

  for (const schedule of directory.schedules) {
    const doctor = doctorById.get(schedule.doctorId);
    const practice = doctor && practiceById.get(doctor.practiceId);
    if (!doctor || !practice) continue;
    const step = schedule.slotMinutes * 60000;
    const seedOffer = hashString(`offer:${doctor.id}`);
    const seedBooked = hashString(`booked:${doctor.id}`);
    const seedVideo = hashString(`video:${doctor.id}`);
    for (const { offset, day, weekday } of days_) {
      for (const period of practice.openingHours[weekday] ?? []) {
        let start = at(offset, day, period.open);
        const end = at(offset, day, period.close);
        while (start + step <= end) {
          const minute = start / 60000;
          const roll = (mix32(seedOffer, minute) % 10000) / 10000;
          if (roll < schedule.offerRate) {
            const startIso = new Date(start).toISOString();
            // Nähe-Effekt: kurzfristige Termine sind häufiger schon vergeben
            const nearFactor = offset === 0 ? 1.08 : offset === 1 ? 1.04 : 1;
            const bookedRoll = (mix32(seedBooked, minute) % 10000) / 10000;
            const booked = bookedRoll < Math.min(0.995, schedule.bookedRate * nearFactor);
            slots.push({
              id: uuidFromString(`slot:${doctor.id}:${startIso}`),
              doctorId: doctor.id,
              practiceId: practice.id,
              startsAt: startIso,
              endsAt: new Date(start + step).toISOString(),
              status: booked ? 'booked' : 'open',
              heldUntil: null,
              holdReason: null,
              visitType:
                practice.offersVideo && mix32(seedVideo, minute) % 5 === 0 ? 'video' : 'in_person',
              updatedAt,
            });
          }
          start += step;
        }
      }
    }
  }
  return slots;
}

/** Zeitpunkt des letzten Abgleichs je Praxis relativ zu `now`. */
export function syncTimestamps(directory: DemoDirectory, now: Date): Map<string, string> {
  return new Map(
    directory.sync.map((s) => [
      s.practiceId,
      new Date(now.getTime() - s.syncAgeMinutes * 60000).toISOString(),
    ]),
  );
}
