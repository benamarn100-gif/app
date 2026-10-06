import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfirmProvider } from '@/components/ConfirmDialog';
import { ToastProvider } from '@/components/Toast';
import { cities } from '@/config/city';
import { createQueryClient, DataProvider } from '@/data/DataProvider';
import { MemoryRepository } from '@/data/memory/MemoryRepository';
import type { MedNowRepository } from '@/data/repository';
import { FixedThemeProvider } from '@/design/theme';
import type { ColorScheme } from '@/design/tokens';

// Nach jedem Test aufräumen: Demo-Timer (Warteliste, Angebote) und Query-Caches,
// sonst halten offene Timer den Jest-Worker am Leben.
const repositories = new Set<MemoryRepository>();
const clients = new Set<ReturnType<typeof createQueryClient>>();
afterEach(() => {
  for (const repository of repositories) repository.dispose();
  for (const client of clients) client.clear();
  repositories.clear();
  clients.clear();
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function createTestRepository(now?: Date) {
  const repository = new MemoryRepository({
    city: cities.fulda,
    latencyMs: 0,
    now: now ? () => now : undefined,
  });
  repositories.add(repository);
  return repository;
}

/** Rendert mit allen App-Providern (Theme, Daten ohne Persistenz, Toasts, Safe Area). */
export function renderWithProviders(
  ui: ReactElement,
  options: { repository?: MedNowRepository; scheme?: ColorScheme } = {},
) {
  const repository = options.repository ?? createTestRepository();
  const client = createQueryClient();
  clients.add(client);
  // gcTime Infinity: keine GC-Timer, die den Worker nach dem Test am Leben halten
  client.setDefaultOptions({
    queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    mutations: { gcTime: Infinity },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SafeAreaProvider initialMetrics={metrics}>
      <FixedThemeProvider scheme={options.scheme ?? 'light'}>
        <DataProvider repository={repository} queryClient={client} persist={false}>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </DataProvider>
      </FixedThemeProvider>
    </SafeAreaProvider>
  );
  return { repository, client, result: render(ui, { wrapper: Wrapper }) };
}
