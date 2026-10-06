import type { ErrorBoundaryProps } from 'expo-router';

import { EmptyState, IllustrationOffline, Screen } from '@/components';
import { useT } from '@/i18n/useT';
import { captureError } from '@/lib/monitoring';

/** Fängt Render-Fehler je Route ab und bietet immer eine nächste Aktion an. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useT();
  captureError(error);
  return (
    <Screen edgeTop>
      <EmptyState
        tone="error"
        illustration={<IllustrationOffline size={160} />}
        title={t('errors.generic')}
        primaryAction={{ label: t('common.retry'), onPress: () => void retry() }}
      />
    </Screen>
  );
}
