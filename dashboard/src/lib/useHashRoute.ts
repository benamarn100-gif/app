import { useCallback, useSyncExternalStore } from 'react';

export const TABS = ['week', 'bookings', 'templates'] as const;
export type Tab = (typeof TABS)[number];
export type Route = { tab: Tab; focus?: string };

export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const tab = (TABS as readonly string[]).includes(path) ? (path as Tab) : 'week';
  const focus = new URLSearchParams(query).get('focus') ?? undefined;
  return focus ? { tab, focus } : { tab };
}

export function routeHref(route: Route): string {
  return `#/${route.tab}${route.focus ? `?focus=${encodeURIComponent(route.focus)}` : ''}`;
}

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

/** Einfaches Hash-Routing: Zurück-Taste und Lesezeichen funktionieren ohne Server-Konfiguration. */
export function useHashRoute(): [Route, (route: Route) => void] {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  const navigate = useCallback((route: Route) => {
    window.location.hash = routeHref(route);
  }, []);
  return [parseRoute(hash), navigate];
}
