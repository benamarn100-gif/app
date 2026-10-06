import { createContext, useContext, type ReactNode } from 'react';

import type { DashboardConfig } from '../config';
import type { DashboardRepository } from './types';

/**
 * Lädt nur die benötigte Implementierung (getrennte Bundles): Demo-Generator bzw.
 * Supabase-Client landen nie gemeinsam im Browser.
 */
export async function createRepository(config: DashboardConfig): Promise<DashboardRepository> {
  if (config.dataMode === 'supabase' && config.supabaseUrl && config.supabaseAnonKey) {
    const { createDashboardClient, SupabaseDashboardRepository } =
      await import('./SupabaseDashboardRepository');
    return new SupabaseDashboardRepository(
      createDashboardClient(config.supabaseUrl, config.supabaseAnonKey),
    );
  }
  const { DemoDashboardRepository } = await import('./DemoDashboardRepository');
  return new DemoDashboardRepository({ city: config.demoCity });
}

const RepositoryContext = createContext<DashboardRepository | null>(null);

export function RepositoryProvider({
  repository,
  children,
}: {
  repository: DashboardRepository;
  children: ReactNode;
}) {
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): DashboardRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error('useRepository() außerhalb von <RepositoryProvider>');
  return repository;
}
