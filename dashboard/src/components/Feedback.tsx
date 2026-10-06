import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { useT } from '../i18n';
import { cx } from '../lib/cx';
import { Button } from './Button';
import { CalendarIllustration } from './Illustrations';

/** Platzhalter beim Laden: ruhige Flächen statt Spinner. */
export function Skeleton({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={cx('skeleton-group', className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}

export function LoadingRegion({ children }: { children?: ReactNode }) {
  const { t } = useT();
  return (
    <div className="loading-region" aria-busy="true">
      <span className="visually-hidden">{t('app.loading')}</span>
      {children ?? <Skeleton lines={4} />}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  illustration,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  illustration?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__art" aria-hidden>
        {illustration ?? <CalendarIllustration />}
      </div>
      <p className="empty__title">{title}</p>
      {body ? <p className="empty__body">{body}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <div className="error-state" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <Button variant="secondary" icon={<RefreshCw size={18} />} onClick={onRetry}>
          {t('app.retry')}
        </Button>
      ) : null}
    </div>
  );
}
