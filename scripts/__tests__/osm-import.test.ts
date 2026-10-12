import {
  convert,
  isNotDoctor,
  featureToElement,
  geofabrikUrl,
  jsonLiteral,
  normalizeWebsite,
  parseOpeningHours,
  specialtiesFor,
  toRow,
  type OsmElement,
} from '../osm-import';

const address = {
  'addr:street': 'Bahnhofstraße',
  'addr:housenumber': '5',
  'addr:postcode': '36037',
  'addr:city': 'Fulda',
};

describe('Fachrichtungen', () => {
  it('nimmt getaggte Fachrichtungen', () => {
    expect(
      specialtiesFor({ amenity: 'doctors', 'healthcare:speciality': 'general;internal' }),
    ).toEqual(['allgemeinmedizin', 'innere-medizin']);
    expect(specialtiesFor({ amenity: 'doctors', 'healthcare:speciality': 'cardiology' })).toEqual([
      'innere-medizin',
    ]);
    expect(specialtiesFor({ amenity: 'dentist' })).toEqual(['zahnmedizin']);
    expect(specialtiesFor({ healthcare: 'psychotherapist' })).toEqual([
      'psychiatrie-psychotherapie',
    ]);
  });

  it('nutzt den Namen nur ohne Tag und nur bei eindeutigen Wörtern', () => {
    expect(specialtiesFor({ amenity: 'doctors', name: 'Hausarztpraxis am Markt' })).toEqual([
      'allgemeinmedizin',
    ]);
    expect(specialtiesFor({ amenity: 'doctors', name: 'HNO-Praxis Dr. Beispiel' })).toEqual([
      'hno',
    ]);
    expect(
      specialtiesFor({ amenity: 'doctors', name: 'Kinderzahnarztpraxis Sonnenschein' }),
    ).toEqual(['zahnmedizin']);
    expect(specialtiesFor({ amenity: 'doctors', name: 'Nervenarzt Dr. Muster' })).toEqual([
      'neurologie',
      'psychiatrie-psychotherapie',
    ]);
    expect(specialtiesFor({ amenity: 'doctors', name: 'Praxis Dr. Muster' })).toEqual([]);
    expect(
      specialtiesFor({
        amenity: 'doctors',
        'healthcare:speciality': 'radiology',
        name: 'Radiologie Mitte',
      }),
    ).toEqual([]);
  });
});

describe('Öffnungszeiten', () => {
  it('liest einfache Angaben', () => {
    expect(parseOpeningHours('Mo-Fr 08:00-12:00; Mo,Tu,Th 08:00-12:00,15:00-18:00')).toBeNull(); // widersprüchlich
    expect(parseOpeningHours('Mo,Tu,Th 08:00-12:00,15:00-18:00; We,Fr 8:00-12:00; PH off')).toEqual(
      {
        mon: [
          { open: '08:00', close: '12:00' },
          { open: '15:00', close: '18:00' },
        ],
        tue: [
          { open: '08:00', close: '12:00' },
          { open: '15:00', close: '18:00' },
        ],
        wed: [{ open: '08:00', close: '12:00' }],
        thu: [
          { open: '08:00', close: '12:00' },
          { open: '15:00', close: '18:00' },
        ],
        fri: [{ open: '08:00', close: '12:00' }],
      },
    );
  });

  it('versteht Zusatzregeln, Leerzeichen in Tageslisten und freie Tage', () => {
    expect(parseOpeningHours('Mo-Fr 08:00-12:00, We 14:00-16:00; Sa,Su off')).toEqual({
      mon: [{ open: '08:00', close: '12:00' }],
      tue: [{ open: '08:00', close: '12:00' }],
      wed: [
        { open: '08:00', close: '12:00' },
        { open: '14:00', close: '16:00' },
      ],
      thu: [{ open: '08:00', close: '12:00' }],
      fri: [{ open: '08:00', close: '12:00' }],
    });
    expect(parseOpeningHours('Mo, We 09:00-11:00')).toEqual({
      mon: [{ open: '09:00', close: '11:00' }],
      wed: [{ open: '09:00', close: '11:00' }],
    });
    expect(parseOpeningHours('Mo-Fr 08:00-12:00; We off')?.wed).toBeUndefined();
    expect(parseOpeningHours('Mo 08:00-12:00; PH,SH off')).toEqual({
      mon: [{ open: '08:00', close: '12:00' }],
    });
  });

  it('gibt bei Unklarem lieber nichts aus', () => {
    for (const value of [
      'Mo-Fr 08:00-12:00 "nach Vereinbarung"',
      'Mo-Fr 08:00-12:00 || "Termine nach Absprache"',
      'Jan-Jun Mo-Fr 08:00-12:00',
      'Mo-Fr 08:00-12:00; PH 10:00-12:00',
      'Mo-Fr 22:00-02:00',
      'Mo-Fr',
      'Mo-Fr 8-12',
      'Mo-Di 08:00-12:00',
      'Mo-Fr 08:00-12:00,11:00-14:00',
      '',
    ])
      expect(parseOpeningHours(value)).toBeNull();
  });
});

describe('Zeilen', () => {
  const doctor = (tags: Record<string, string>, extra: Partial<OsmElement> = {}): OsmElement => ({
    type: 'node',
    id: 1,
    lat: 50.5541234567,
    lon: 9.681,
    tags: { amenity: 'doctors', ...tags },
    ...extra,
  });

  it('übernimmt nur echte Angaben', () => {
    expect(
      toRow(
        doctor({
          ...address,
          name: 'Hausarztpraxis Dr. Beispiel',
          'healthcare:speciality': 'general',
          phone: '+49 661 1234; +49 661 5678',
          website: 'www.example.org',
          wheelchair: 'yes',
          'language:en': 'yes',
          'language:xx': 'yes',
          opening_hours: 'Mo-Fr 08:00-12:00',
        }),
      ),
    ).toEqual({
      ref: 'node/1',
      name: 'Hausarztpraxis Dr. Beispiel',
      street: 'Bahnhofstraße 5',
      postal_code: '36037',
      city: 'Fulda',
      lat: 50.554123,
      lng: 9.681,
      specialties: ['allgemeinmedizin'],
      phone: '+49 661 1234',
      website: 'https://www.example.org/',
      languages: ['de', 'en'],
      wheelchair: true,
      opening_hours: {
        mon: [{ open: '08:00', close: '12:00' }],
        tue: [{ open: '08:00', close: '12:00' }],
        wed: [{ open: '08:00', close: '12:00' }],
        thu: [{ open: '08:00', close: '12:00' }],
        fri: [{ open: '08:00', close: '12:00' }],
      },
    });
  });

  it('lässt Unvollständiges weg', () => {
    expect(toRow(doctor({ ...address, 'healthcare:speciality': 'general' }))).toBe('noName');
    expect(toRow(doctor({ name: 'Hausarztpraxis', 'addr:city': 'Fulda' }))).toBe('noAddress');
    expect(toRow(doctor({ ...address, 'addr:postcode': '3603', name: 'Hausarztpraxis' }))).toBe(
      'noAddress',
    );
    expect(toRow(doctor({ ...address, name: 'Praxis Dr. Muster' }))).toBe('noSpecialty');
    expect(
      toRow(
        doctor({
          ...address,
          name: 'Betriebsarzt',
          'healthcare:speciality': 'general',
          access: 'private',
        }),
      ),
    ).toBe('notPublic');
  });

  it('erkennt Privatpraxen und nimmt bei Gebäuden den Mittelpunkt', () => {
    const row = toRow(
      doctor(
        { ...address, name: 'Privatpraxis für Dermatologie' },
        { type: 'way', id: 7, lat: undefined, lon: undefined, center: { lat: 50.1, lon: 8.6 } },
      ),
    );
    expect(row).toMatchObject({
      ref: 'way/7',
      lat: 50.1,
      lng: 8.6,
      private_only: true,
      specialties: ['dermatologie'],
    });
  });

  it('entfernt doppelt erfasste Praxen (Punkt und Gebäude)', () => {
    const tags = { ...address, name: 'Zahnarztpraxis Muster' };
    const { rows, skipped } = convert([
      {
        type: 'way',
        id: 9,
        center: { lat: 50.55, lon: 9.68 },
        tags: { building: 'yes', amenity: 'dentist', ...tags },
      },
      { type: 'node', id: 3, lat: 50.55, lon: 9.68, tags: { amenity: 'dentist', ...tags } },
      { type: 'node', id: 4, lat: 50.55, lon: 9.68, tags: { amenity: 'doctors', name: 'Praxis' } },
    ]);
    expect(rows.map((r) => r.ref)).toEqual(['node/3']);
    expect(skipped).toMatchObject({ duplicate: 1, noAddress: 1 });
  });
});

describe('Keine Arztpraxis', () => {
  it('filtert Heilpraktiker, Therapie- und Wellnessangebote', () => {
    expect(isNotDoctor({ amenity: 'doctors', name: 'Elke Muster, M.A., HP' })).toBe(true);
    expect(isNotDoctor({ amenity: 'doctors', name: 'Naturheilpraxis am Park' })).toBe(true);
    expect(isNotDoctor({ amenity: 'doctors', name: 'Yoga & Gesundheit' })).toBe(true);
    expect(
      isNotDoctor({ amenity: 'doctors', healthcare: 'alternative', name: 'Praxis Sonne' }),
    ).toBe(true);
    expect(isNotDoctor({ amenity: 'doctors', healthcare: 'doctor', name: 'Hausarztpraxis' })).toBe(
      false,
    );
    expect(isNotDoctor({ amenity: 'doctors', name: 'Dr. med. Beispiel (HNO)' })).toBe(false);
    expect(isNotDoctor({ healthcare: 'psychotherapist', name: 'Praxis für Psychotherapie' })).toBe(
      false,
    );
  });

  it('zählt sie gesondert', () => {
    const { rows, skipped } = convert([
      {
        type: 'node',
        id: 5,
        lat: 50.55,
        lon: 9.68,
        tags: {
          amenity: 'doctors',
          'healthcare:speciality': 'general',
          name: 'Heilpraktikerin Muster',
          ...address,
        },
      },
    ]);
    expect(rows).toHaveLength(0);
    expect(skipped.notDoctor).toBe(1);
  });
});

describe('Adressen ergänzen', () => {
  const square = (lat: number, lon: number, d = 0.0002) => [
    { lat, lon },
    { lat: lat + d, lon },
    { lat: lat + d, lon: lon + d },
    { lat, lon: lon + d },
    { lat, lon },
  ];

  it('übernimmt die Adresse des Gebäudes, in dem die Praxis liegt', () => {
    const { rows, fromBuilding } = convert([
      {
        type: 'node',
        id: 1,
        lat: 50.55011,
        lon: 9.68011,
        tags: { amenity: 'dentist', name: 'Zahnarztpraxis Muster' },
      },
      // großes Gebäude außen, kleines innen: das kleinere zählt
      {
        type: 'way',
        id: 10,
        geometry: square(50.55, 9.68, 0.001),
        tags: { building: 'yes', ...address, 'addr:housenumber': '1' },
      },
      {
        type: 'way',
        id: 11,
        geometry: square(50.5501, 9.6801),
        tags: { building: 'yes', ...address, 'addr:housenumber': '7' },
      },
      // Gebäude daneben (Punkt liegt nicht darin)
      {
        type: 'way',
        id: 12,
        geometry: square(50.552, 9.682),
        tags: { building: 'yes', ...address, 'addr:housenumber': '9' },
      },
    ]);
    expect(fromBuilding).toBe(1);
    expect(rows).toEqual([
      expect.objectContaining({ ref: 'node/1', street: 'Bahnhofstraße 7', city: 'Fulda' }),
    ]);
  });

  it('ergänzt den Ort aus der Postleitzahl, wenn er eindeutig vorkommt', () => {
    const { rows, cityFromPostcode } = convert([
      {
        type: 'node',
        id: 1,
        lat: 50.55,
        lon: 9.68,
        tags: { amenity: 'dentist', name: 'Zahnarzt A', ...address, 'addr:city': '' },
      },
      {
        type: 'node',
        id: 2,
        lat: 50.56,
        lon: 9.69,
        tags: { amenity: 'dentist', name: 'Zahnarzt B', ...address, 'addr:housenumber': '9' },
      },
    ]);
    expect(cityFromPostcode).toBe(1);
    expect(rows.map((r) => r.city)).toEqual(['Fulda', 'Fulda']);
  });
});

describe('Hilfen', () => {
  it('Website nur mit http(s) und Domain', () => {
    expect(normalizeWebsite('praxis-beispiel.de')).toBe('https://praxis-beispiel.de/');
    expect(normalizeWebsite('javascript:alert(1)')).toBeUndefined();
    expect(normalizeWebsite('localhost')).toBeUndefined();
  });

  it('JSON sicher in SQL einbetten', () => {
    const literal = jsonLiteral([{ name: "O'Brien $$ ; drop table x" }]);
    const tag = /^\$(osm[0-9a-f]{16})\$/.exec(literal)![1]!;
    expect(literal).toBe(`$${tag}$[{"name":"O'Brien $$ ; drop table x"}]$${tag}$::jsonb`);
  });

  it('Geofabrik-Auszug je Bundesland', () => {
    expect(geofabrikUrl('HE')).toBe(
      'https://download.geofabrik.de/europe/germany/hessen-latest.osm.pbf',
    );
    expect(geofabrikUrl('NW')).toContain('/nordrhein-westfalen-latest.osm.pbf');
  });

  it('liest osmium-GeoJSON: Punkte direkt, Flächen mit Mittelpunkt', () => {
    expect(
      featureToElement({
        geometry: { type: 'Point', coordinates: [9.68, 50.55] },
        properties: { '@type': 'node', '@id': '7', amenity: 'dentist' },
      }),
    ).toEqual({ type: 'node', id: 7, lat: 50.55, lon: 9.68, tags: { amenity: 'dentist' } });
    const ring = [
      [9.68, 50.55],
      [9.682, 50.55],
      [9.682, 50.552],
      [9.68, 50.552],
      [9.68, 50.55],
    ];
    const way = featureToElement(
      {
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: { '@type': 'way', '@id': '9', building: 'yes' },
      },
      true,
    );
    expect(way).toMatchObject({ type: 'way', id: 9 });
    expect(way?.center?.lat).toBeCloseTo(50.551, 6);
    expect(way?.center?.lon).toBeCloseTo(9.681, 6);
    expect(way?.geometry).toHaveLength(5);
    expect(
      featureToElement({ geometry: null, properties: { '@type': 'area', '@id': '1' } }),
    ).toBeNull();
  });
});
