import * as Sentry from '@sentry/react-native';

import { usePreferences } from '@/state/preferences';

const mockEnv: { sentryDsn: string | undefined } = { sentryDsn: undefined };
// Getter: Der Mock wird vor `mockEnv` geladen (jest.mock wird nach oben gezogen).
jest.mock('@/config/env', () => ({
  get env() {
    return mockEnv;
  },
}));

// eslint-disable-next-line import/first -- nach dem Mock laden
import {
  bindMonitoring,
  captureError,
  isEuDsn,
  monitoringEnabled,
  scrubEvent,
} from '../monitoring';

const EU_DSN = 'https://abc@o123.ingest.de.sentry.io/456';

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  usePreferences.setState({ crashReportsOptIn: false });
  mockEnv.sentryDsn = undefined;
});

describe('Fehler-Monitoring (Opt-in, nur EU)', () => {
  it('akzeptiert nur EU-Endpunkte', () => {
    expect(isEuDsn(EU_DSN)).toBe(true);
    expect(isEuDsn('https://glitchtip.example.de/1')).toBe(true);
    expect(isEuDsn('https://abc@o123.ingest.us.sentry.io/456')).toBe(false);
    expect(isEuDsn(undefined)).toBe(false);
  });

  it('ist ohne Einwilligung oder ohne EU-DSN aus', () => {
    mockEnv.sentryDsn = EU_DSN;
    expect(monitoringEnabled()).toBe(false);
    usePreferences.setState({ crashReportsOptIn: true });
    expect(monitoringEnabled()).toBe(true);
    mockEnv.sentryDsn = 'https://abc@o1.ingest.us.sentry.io/2';
    expect(monitoringEnabled()).toBe(false);
  });

  it('startet erst nach Opt-in, beendet beim Widerruf und sendet nur dann', () => {
    mockEnv.sentryDsn = EU_DSN;
    const unbind = bindMonitoring();
    captureError(new Error('vorher'));
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();

    usePreferences.setState({ crashReportsOptIn: true });
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: EU_DSN, sendDefaultPii: false, tracesSampleRate: 0 }),
    );
    captureError(new Error('nachher'));
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);

    usePreferences.setState({ crashReportsOptIn: false });
    expect(Sentry.close).toHaveBeenCalled();
    captureError(new Error('nach Widerruf'));
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    unbind();
  });

  it('entfernt Nutzer-, Anfrage- und Zusatzdaten und bereinigt Texte', () => {
    const event = scrubEvent({
      message: 'Fehler bei alex@example.org',
      user: { id: 'u1', ip_address: '1.2.3.4' },
      request: { url: 'https://x/?lat=50.5558' },
      extra: { phone: '0661 123456' },
      exception: { values: [{ value: 'slot 7a1c2f0e-1111-4c2a-9a3b-1234567890ab at 50.5558' }] },
      breadcrumbs: [{ message: 'Tel. 0661 123456', data: { url: 'x' } }],
    });
    expect(event.user).toBeUndefined();
    expect(event.request).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.message).toBe('Fehler bei [email]');
    expect(event.exception?.values?.[0]?.value).toBe('slot [id] at [koordinate]');
    expect(event.breadcrumbs?.[0]).toEqual({ message: 'Tel. [nummer]' });
  });
});
