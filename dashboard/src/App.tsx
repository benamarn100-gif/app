import { QueryClientProvider, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { LoginScreen } from './auth/LoginScreen';
import { MfaScreen } from './auth/MfaScreen';
import { ErrorState, LoadingRegion } from './components/Feedback';
import { IdleWarning } from './components/IdleWarning';
import { ToastProvider } from './components/Toast';
import { createQueryClient, useAuthState, usePractices } from './data/queries';
import { RepositoryProvider, useRepository } from './data/RepositoryContext';
import type { DashboardRepository } from './data/types';
import { I18nProvider, useT, type Locale } from './i18n';
import { readStorage, writeStorage } from './lib/storage';
import { useIdleSignOut } from './lib/useIdleSignOut';
import { PracticePicker } from './screens/PracticePicker';
import { Shell } from './screens/Shell';

const PRACTICE_KEY = 'mednow.dashboard.practice';

function useSignOut(onDone?: () => void) {
  const repo = useRepository();
  const client = useQueryClient();
  return () => {
    // Patientendaten sofort aus dem Speicher entfernen
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
    writeStorage(PRACTICE_KEY, null, 'session');
    onDone?.();
    void repo.auth.signOut();
  };
}

function PracticeGate({ email }: { email: string | null }) {
  const { t } = useT();
  const practices = usePractices(true);
  const [selectedId, setSelectedId] = useState(() => readStorage(PRACTICE_KEY, 'session'));
  const signOut = useSignOut();

  if (practices.isPending) return <LoadingRegion />;
  if (practices.isError) {
    return <ErrorState message={t('app.loadFailed')} onRetry={() => void practices.refetch()} />;
  }
  const list = practices.data;
  const membership =
    list.find((m) => m.practice.id === selectedId) ?? (list.length === 1 ? list[0] : undefined);
  if (!membership) {
    return (
      <PracticePicker
        memberships={list}
        onSignOut={signOut}
        onSelect={(id) => {
          setSelectedId(id);
          writeStorage(PRACTICE_KEY, id, 'session');
        }}
      />
    );
  }
  return (
    <Shell
      membership={membership}
      email={email}
      canSwitch={list.length > 1}
      onSwitch={() => {
        setSelectedId(null);
        writeStorage(PRACTICE_KEY, null, 'session');
      }}
      onSignOut={signOut}
    />
  );
}

function AuthGate() {
  const { t } = useT();
  const repo = useRepository();
  const auth = useAuthState();
  const [idleNotice, setIdleNotice] = useState(false);
  const signOutIdle = useSignOut(() => setIdleNotice(true));
  const signOut = useSignOut();
  const idle = useIdleSignOut(auth.data?.kind === 'ready' && repo.mode === 'supabase', signOutIdle);

  if (auth.isPending) return <LoadingRegion />;
  if (auth.isError) {
    return <ErrorState message={t('app.loadFailed')} onRetry={() => void auth.refetch()} />;
  }
  switch (auth.data.kind) {
    case 'signedOut':
      return <LoginScreen notice={idleNotice ? t('app.idleSignedOut') : null} />;
    case 'mfa':
      return <MfaScreen enrolled={auth.data.enrolled} />;
    case 'ready':
      return (
        <>
          <PracticeGate email={auth.data.email} />
          <IdleWarning deadline={idle.deadline} onStay={idle.stay} onSignOut={signOut} />
        </>
      );
  }
}

export function App({
  repository,
  queryClient,
  locale,
}: {
  repository: DashboardRepository;
  queryClient?: QueryClient;
  locale?: Locale;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <I18nProvider locale={locale}>
      <RepositoryProvider repository={repository}>
        <QueryClientProvider client={client}>
          <ToastProvider>
            <AuthGate />
          </ToastProvider>
        </QueryClientProvider>
      </RepositoryProvider>
    </I18nProvider>
  );
}
