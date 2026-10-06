import { render } from '@testing-library/react';

import { App } from '../App';
import { DemoDashboardRepository, type DemoOptions } from '../data/DemoDashboardRepository';
import { createQueryClient } from '../data/queries';

export function createTestRepository(options: DemoOptions = {}) {
  return new DemoDashboardRepository({ persist: false, simulateLive: false, ...options });
}

export function renderApp(repository = createTestRepository()) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: 0 } });
  const view = render(<App repository={repository} queryClient={client} locale="de" />);
  return { ...view, repository, client };
}
