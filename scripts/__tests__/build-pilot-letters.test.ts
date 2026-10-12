import { addressName, letterHtml, senderFromEnv } from '../build-pilot-letters';

const sender = {
  name: 'Max Beispiel',
  address: 'Musterweg 1, 12345 Musterstadt',
  phone: '0000 000000',
  email: 'kontakt@example.org',
};

describe('Serienbriefe an Pilotpraxen', () => {
  it('Absender nur aus der Umgebung, vollständig', () => {
    expect(() => senderFromEnv({ KONTAKT_NAME: 'Max' })).toThrow(/KONTAKT/);
    expect(
      senderFromEnv({
        KONTAKT_NAME: sender.name,
        KONTAKT_ANSCHRIFT: sender.address,
        KONTAKT_TELEFON: sender.phone,
        KONTAKT_EMAIL: sender.email,
      }),
    ).toEqual(sender);
  });

  it('lange Praxisnamen passen ins Anschriftfeld', () => {
    expect(addressName('Hausarztpraxis am Markt')).toEqual(['Hausarztpraxis am Markt']);
    const lines = addressName(
      'Dr. med. Ulrich Beispiel & Dr. med. Catrin Muster Fachärzte für Kinder- und Jugendmedizin, Kinderdiabetologie',
    );
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.length <= 43)).toBe(true);
  });

  it('Brief: Anschrift, Ort, Hinweis auf den Verzeichniseintrag, sichere Ausgabe', () => {
    const html = letterHtml(
      {
        name: 'Praxis <Test> & Co',
        street: 'Am Markt 1',
        plz: '36037',
        city: 'Fulda',
        specialty: 'Allgemeinmedizin',
        nearby: true,
      },
      sender,
      new Date('2026-10-12T10:00:00Z'),
    );
    expect(html).toContain('Praxis &lt;Test&gt; &amp; Co<br>Am Markt 1<br>36037 Fulda');
    expect(html).toContain('in Fulda Praxen für Allgemeinmedizin');
    expect(html).toContain('gern bei Ihnen in der Praxis');
    expect(html).toContain('Möchten Sie dort nicht erscheinen');
    expect(html).toContain('12. Oktober 2026');
  });
});
