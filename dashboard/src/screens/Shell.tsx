import { CalendarDays, Clock4, LogOut, Repeat, Users } from 'lucide-react';
import { useCallback } from 'react';

import { brand } from '@app/config/brand';

import { Button } from '../components/Button';
import { LogoMark } from '../components/Illustrations';
import { DemoBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { useLiveUpdates } from '../data/queries';
import { useRepository } from '../data/RepositoryContext';
import type { LiveEvent, Membership } from '../data/types';
import { useT, type MessageKey } from '../i18n';
import { routeHref, useHashRoute, type Tab } from '../lib/useHashRoute';
import { BookingsScreen } from './BookingsScreen';
import { LanguageSwitch } from './LanguageSwitch';
import { TemplatesScreen } from './TemplatesScreen';
import { WeekScreen } from './WeekScreen';

const NAV: { tab: Tab; label: MessageKey; icon: typeof CalendarDays }[] = [
  { tab: 'week', label: 'nav.week', icon: CalendarDays },
  { tab: 'bookings', label: 'nav.bookings', icon: Users },
  { tab: 'templates', label: 'nav.templates', icon: Clock4 },
];

export function Shell({
  membership,
  email,
  canSwitch,
  onSwitch,
  onSignOut,
}: {
  membership: Membership;
  email: string | null;
  canSwitch: boolean;
  onSwitch: () => void;
  onSignOut: () => void;
}) {
  const { t } = useT();
  const repo = useRepository();
  const toast = useToast();
  const [route, navigate] = useHashRoute();
  const { practice, role } = membership;

  const handleLive = useCallback(
    (event: LiveEvent) => {
      if (event.status !== 'booked') return;
      toast.show(t('bookings.newBooking'), 'info', {
        label: t('nav.bookings'),
        onPress: () => navigate({ tab: 'bookings' }),
      });
    },
    [navigate, t, toast],
  );
  useLiveUpdates(practice, handleLive);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {t('app.skipToContent')}
      </a>
      <header className="topbar">
        <span className="brand">
          <LogoMark size={28} />
          <span className="brand__name">{brand.name}</span>
          <span className="brand__product">{t('app.title')}</span>
          {repo.mode === 'demo' ? <DemoBadge /> : null}
        </span>
        <div className="topbar__practice">
          <span className="topbar__practice-name">{practice.name}</span>
          <span className="muted">
            {t(`picker.role_${role}`)}
            {email ? ` · ${email}` : ''}
          </span>
        </div>
        <div className="topbar__actions">
          <LanguageSwitch />
          {canSwitch ? (
            <Button variant="ghost" size="sm" icon={<Repeat size={18} />} onClick={onSwitch}>
              {t('picker.title')}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" icon={<LogOut size={18} />} onClick={onSignOut}>
            {t('app.signOut')}
          </Button>
        </div>
      </header>
      {repo.mode === 'demo' ? (
        <p className="demo-notice" role="note">
          {t('app.demoNotice')}
        </p>
      ) : null}
      <nav className="tabs" aria-label={t('app.mainNav')}>
        {NAV.map(({ tab, label, icon: Icon }) => (
          <a
            key={tab}
            className="tabs__link"
            href={routeHref({ tab })}
            aria-current={route.tab === tab ? 'page' : undefined}
          >
            <Icon size={20} aria-hidden />
            {t(label)}
          </a>
        ))}
      </nav>
      <main id="main" className="main" tabIndex={-1}>
        {route.tab === 'week' ? (
          <WeekScreen
            practice={practice}
            onOpenBooking={(id) => navigate({ tab: 'bookings', focus: id })}
          />
        ) : route.tab === 'bookings' ? (
          <BookingsScreen key={route.focus ?? 'all'} practice={practice} focusId={route.focus} />
        ) : (
          <TemplatesScreen practice={practice} />
        )}
      </main>
    </div>
  );
}
