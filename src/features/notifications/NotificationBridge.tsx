import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useToast } from '@/components';
import { brand } from '@/config/brand';
import { useRepository } from '@/data/DataProvider';
import { queryKeys } from '@/data/queryKeys';
import { useT } from '@/i18n/useT';
import { configureNotifications, presentOfferNotification } from '@/lib/notifications';

/**
 * Verbindet Benachrichtigungen mit der App:
 *  - Tippen auf eine Mitteilung öffnet das Ziel (z. B. Angebot der Warteliste),
 *  - neue Angebote (Realtime bzw. Demo-Simulation) erscheinen als Toast und – im
 *    Demo-Modus – als lokale Mitteilung (simuliert die Push-Nachricht).
 */
export function NotificationBridge() {
  const repo = useRepository();
  const client = useQueryClient();
  const toast = useToast();
  const { t } = useT();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void configureNotifications(t);
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      const scheme = typeof url === 'string' ? appScheme(url) : null;
      if (typeof url === 'string' && scheme) {
        router.push(url.replace(`${scheme}://`, '/') as never);
      }
    });
    return () => sub.remove();
  }, [t]);

  useEffect(
    () =>
      repo.subscribeToOffers((offer) => {
        void client.invalidateQueries({ queryKey: queryKeys.offers });
        void client.invalidateQueries({ queryKey: ['slots'] });
        toast.show(t('offer.title'), 'success', {
          label: t('offer.accept'),
          onPress: () => router.push(`/offer/${offer.id}`),
        });
        if (repo.mode === 'memory') void presentOfferNotification(offer.id, t);
      }),
    [client, repo, t, toast],
  );

  return null;
}

/** Eigenes Schema – auch das älterer Testversionen (mednow://) – sonst null. */
function appScheme(url: string): string | null {
  return [brand.scheme, ...brand.legacySchemes].find((s) => url.startsWith(`${s}://`)) ?? null;
}
