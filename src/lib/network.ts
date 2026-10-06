import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * Verbindet NetInfo mit TanStack Query (pausiert Anfragen offline). Im Web bleibt es beim
 * Standard von TanStack (`navigator.onLine`): NetInfo prüft dort per `HEAD /`, was hinter
 * CDNs, Unterpfaden oder eingebettet fälschlich „offline“ ergeben kann.
 */
export function setupOnlineManager() {
  if (Platform.OS === 'web') return;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    }),
  );
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}
