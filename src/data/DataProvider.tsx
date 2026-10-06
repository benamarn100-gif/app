import { createContext, useContext, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { demoCity, env } from '@/config/env';
import { AsyncStorage } from '@/lib/storage';

import { MemoryRepository } from './memory/MemoryRepository';
import { PERSISTED_ROOTS } from './queryKeys';
import { isAppError, type MedNowRepository } from './repository';
import { SupabaseRepository } from './supabase/SupabaseRepository';

let singleton: MedNowRepository | null = null;

/** Datenquelle nach Konfiguration: Supabase oder „Demo ohne Backend“. */
export function getRepository(): MedNowRepository {
  if (!singleton) {
    singleton =
      env.dataMode === 'supabase' && env.supabaseUrl && env.supabaseAnonKey
        ? new SupabaseRepository(env.supabaseUrl, env.supabaseAnonKey)
        : new MemoryRepository({
            city: demoCity,
            latencyMs: 280,
            storage: AsyncStorage,
            // Demo: Nach dem Eintragen in die Warteliste wird nach ~20 s ein Termin frei.
            simulateWaitlistReleaseMs: 20_000,
          });
  }
  return singleton;
}

const RepositoryContext = createContext<MedNowRepository | null>(null);

export function useRepository(): MedNowRepository {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error('useRepository() außerhalb von <DataProvider>');
  return repo;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: (count, error) => !isAppError(error) && count < 2,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'mednow.query-cache.v1',
  throttleTime: 2000,
});

type Props = {
  children: ReactNode;
  /** Für Tests: eigene Datenquelle/QueryClient, ohne Persistenz. */
  repository?: MedNowRepository;
  queryClient?: QueryClient;
  persist?: boolean;
};

export function DataProvider({ children, repository, queryClient, persist = true }: Props) {
  const [repo] = useState(() => repository ?? getRepository());
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <RepositoryContext.Provider value={repo}>
      {persist ? (
        <PersistQueryClientProvider
          client={client}
          persistOptions={{
            persister,
            maxAge: 24 * 60 * 60 * 1000,
            buster: `${repo.mode}-v1`,
            dehydrateOptions: {
              // Offline-Cache nur für öffentliche Suchergebnisse – nie persönliche Daten.
              shouldDehydrateQuery: (q) =>
                q.state.status === 'success' &&
                PERSISTED_ROOTS.includes(q.queryKey[0] as (typeof PERSISTED_ROOTS)[number]),
            },
          }}
        >
          {children}
        </PersistQueryClientProvider>
      ) : (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      )}
    </RepositoryContext.Provider>
  );
}
