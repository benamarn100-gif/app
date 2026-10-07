import { routeUrls } from '../maps';

const practice = { name: 'Praxis Am Markt', location: { lat: 50.5558, lng: 9.6808 } };

describe('Route je Verkehrsmittel', () => {
  it('iOS: Apple Karten mit dirflg', () => {
    expect(routeUrls(practice, 'walk', 'ios')[0]).toContain('dirflg=w');
    expect(routeUrls(practice, 'transit', 'ios')[0]).toContain('dirflg=r');
    expect(routeUrls(practice, undefined, 'ios')[0]).not.toContain('dirflg');
  });

  it('Android: ohne Verkehrsmittel Auswahl der Karten-App, mit Verkehrsmittel Google Maps', () => {
    expect(routeUrls(practice, undefined, 'android')[0]).toMatch(/^geo:/);
    const transit = routeUrls(practice, 'transit', 'android');
    expect(transit[0]).toContain('travelmode=transit');
    expect(transit[1]).toMatch(/^geo:/);
  });

  it('Web: OpenStreetMap für Auto/zu Fuß, ÖPNV über Google Maps', () => {
    expect(routeUrls(practice, 'car', 'web')[0]).toContain('engine=fossgis_osrm_car');
    expect(routeUrls(practice, 'walk', 'web')[0]).toContain('engine=fossgis_osrm_foot');
    expect(routeUrls(practice, 'transit', 'web')[0]).toContain('travelmode=transit');
  });

  it('Ziel sind immer die Praxis-Koordinaten, nie der eigene Standort', () => {
    for (const url of routeUrls(practice, 'car', 'android')) {
      expect(url).toMatch(/50\.5558/);
      expect(url).not.toContain('origin=');
    }
  });
});
