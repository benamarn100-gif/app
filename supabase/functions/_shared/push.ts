/**
 * PushSender – austauschbar (docs/decisions.md D-17). Standard: Expo Push Service.
 * Texte sind bewusst datensparsam: keine Praxis, kein Arzt, keine Fachrichtung
 * (sichtbar auf dem Sperrbildschirm).
 */
export type PushTarget = { token: string; locale: 'de' | 'en'; formal: boolean };
export type PushMessage = { title: string; body: string; data: Record<string, string> };

export interface PushSender {
  send(
    targets: PushTarget[],
    build: (target: PushTarget) => PushMessage,
  ): Promise<{ invalidTokens: string[] }>;
}

const OFFER_TEXT = {
  de: {
    title: 'MedNow',
    informal: 'Ein Termin in deiner Nähe ist frei geworden. Tippe zum Bestätigen.',
    formal: 'Ein Termin in Ihrer Nähe ist frei geworden. Tippen Sie zum Bestätigen.',
  },
  en: {
    title: 'MedNow',
    informal: 'An appointment near you just opened up. Tap to confirm.',
    formal: 'An appointment near you just opened up. Tap to confirm.',
  },
} as const;

const CANCELLED_TEXT = {
  de: {
    title: 'MedNow',
    informal: 'Die Praxis hat einen deiner Termine abgesagt. Details in der App.',
    formal: 'Die Praxis hat einen Ihrer Termine abgesagt. Details in der App.',
  },
  en: {
    title: 'MedNow',
    informal: 'A practice cancelled one of your appointments. See the app for details.',
    formal: 'A practice cancelled one of your appointments. See the app for details.',
  },
} as const;

export function offerMessage(target: PushTarget, offerId: string): PushMessage {
  const text = OFFER_TEXT[target.locale] ?? OFFER_TEXT.de;
  return {
    title: text.title,
    body: target.formal ? text.formal : text.informal,
    data: { type: 'waitlist_offer', offerId, url: `mednow://offer/${offerId}` },
  };
}

/** Absage durch die Praxis (Dashboard). Ohne Praxis, Ärztin/Arzt, Uhrzeit. */
export function cancelledByPracticeMessage(target: PushTarget): PushMessage {
  const text = CANCELLED_TEXT[target.locale] ?? CANCELLED_TEXT.de;
  return {
    title: text.title,
    body: target.formal ? text.formal : text.informal,
    data: { type: 'appointment_cancelled', url: 'mednow://appointments' },
  };
}

/** Baut die Nachricht je Outbox-Art; unbekannte Arten werden nicht verschickt. */
export function messageFor(
  kind: string,
  payload: { offerId?: string },
): ((target: PushTarget) => PushMessage) | null {
  if (kind === 'waitlist_offer' && payload.offerId) {
    const offerId = payload.offerId;
    return (t) => offerMessage(t, offerId);
  }
  if (kind === 'appointment_cancelled_by_practice') return cancelledByPracticeMessage;
  return null;
}

export class ExpoPushSender implements PushSender {
  constructor(private readonly accessToken?: string) {}

  async send(targets: PushTarget[], build: (t: PushTarget) => PushMessage) {
    if (targets.length === 0) return { invalidTokens: [] };
    const messages = targets.map((t) => {
      const m = build(t);
      return {
        to: t.token,
        title: m.title,
        body: m.body,
        data: m.data,
        sound: 'default',
        priority: 'high',
        channelId: 'offers',
        // Sperrbildschirm: Inhalt ist ohnehin neutral; keine Kategorie/Thread mit Praxisnamen.
      };
    });
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) throw new Error(`Expo Push HTTP ${res.status}`);
    const payload = (await res.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };
    const invalidTokens = (payload.data ?? [])
      .map((ticket, i) =>
        ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
          ? targets[i]?.token
          : null,
      )
      .filter((t): t is string => !!t);
    return { invalidTokens };
  }
}
