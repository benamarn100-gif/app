import type { AvailabilityStatus } from '@app/domain/types';

import { useT } from '../i18n';

/** Gleiche Statussprache wie in der App: Farbe + Punkt + Text (nie nur Farbe). */
export function StatusBadge({ status }: { status: AvailabilityStatus }) {
  const { t } = useT();
  return (
    <span className={`badge badge--${status}`}>
      <span className="badge__dot" aria-hidden />
      {t(`status.${status}`)}
    </span>
  );
}

export function DemoBadge() {
  const { t } = useT();
  return <span className="badge badge--demo">{t('app.demoBadge')}</span>;
}
