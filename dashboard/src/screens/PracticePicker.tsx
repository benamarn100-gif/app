import { Building2, LogOut } from 'lucide-react';

import { AuthLayout } from '../auth/LoginScreen';
import { Button } from '../components/Button';
import { EmptyState } from '../components/Feedback';
import type { Membership } from '../data/types';
import { useT } from '../i18n';

export function PracticePicker({
  memberships,
  onSelect,
  onSignOut,
}: {
  memberships: Membership[];
  onSelect: (practiceId: string) => void;
  onSignOut: () => void;
}) {
  const { t } = useT();
  return (
    <AuthLayout>
      <section className="auth__card" aria-labelledby="picker-title">
        <h1 id="picker-title" className="auth__title">
          {t('picker.title')}
        </h1>
        {memberships.length === 0 ? (
          <EmptyState title={t('picker.empty')} />
        ) : (
          <ul className="picker">
            {memberships.map(({ practice, role }) => (
              <li key={practice.id}>
                <button
                  type="button"
                  className="picker__item"
                  onClick={() => onSelect(practice.id)}
                >
                  <Building2 size={22} aria-hidden />
                  <span>
                    <span className="picker__name">{practice.name}</span>
                    <span className="muted">
                      {practice.address.street}, {practice.address.city} ·{' '}
                      {t(`picker.role_${role}`)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="ghost" icon={<LogOut size={18} />} onClick={onSignOut}>
          {t('app.signOut')}
        </Button>
      </section>
    </AuthLayout>
  );
}
