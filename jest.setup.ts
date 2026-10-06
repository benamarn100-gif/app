// Gemeinsames Test-Setup (läuft mit TZ=UTC, siehe package.json → "test").
import 'react-native-gesture-handler/jestSetup';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// FlashList braucht Layout-Messungen → in Tests als FlatList rendern
jest.mock('@shopify/flash-list', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FlatList } = require('react-native');
  return { FlashList: FlatList };
});

jest.mock('react-native-worklets', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-worklets/src/mock'),
);

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('react-native-reanimated/mock');
  return { ...mock, useReducedMotion: () => false };
});

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  close: jest.fn(async () => true),
  captureException: jest.fn(),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'de', languageTag: 'de-DE', regionCode: 'DE' }],
  getCalendars: () => [{ timeZone: 'Europe/Berlin' }],
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

let mockUuidCounter = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuidCounter).padStart(12, '0')}`,
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getExpoPushTokenAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('expo-calendar/legacy', () => ({
  createEventInCalendarAsync: jest.fn(async () => ({ action: 'saved' })),
}));

// Router: Navigation wird in Tests als Aufruf geprüft.
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
  navigate: jest.fn(),
};
export const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  router: mockRouter,
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.current,
  useFocusEffect: jest.fn(),
  Stack: { Screen: () => null },
  Redirect: () => null,
  Link: ({ children }: { children: unknown }) => children,
}));

beforeEach(() => {
  for (const fn of Object.values(mockRouter)) fn.mockClear();
  mockParams.current = {};
});
