import { Lock, Phone, UserRound, Video, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { Practice } from '@app/domain/types';

import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { EmptyState, ErrorState, LoadingRegion } from '../components/Feedback';
import { useToast } from '../components/Toast';
import { useBookings, useCancelAppointment, useToday, type BookingRange } from '../data/queries';
import { errorCode, type Booking } from '../data/types';
import { useT } from '../i18n';
import { cx } from '../lib/cx';
import { berlinIsoDate, formatBerlinDate, formatBerlinTime } from '../lib/time';
import { useNow } from '../lib/useNow';

const RANGES: BookingRange[] = ['today', 'week', 'month'];

export function BookingsScreen({ practice, focusId }: { practice: Practice; focusId?: string }) {
  const { t, locale, reason, ageGroup } = useT();
  const toast = useToast();
  const now = useNow();
  const [range, setRange] = useState<BookingRange>(focusId ? 'month' : 'week');
  const [toCancel, setToCancel] = useState<Booking | null>(null);
  const bookings = useBookings(practice.id, range);
  const doctors = useToday(practice.id).data?.doctors ?? [];
  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.name ?? '';
  const cancel = useCancelAppointment(practice.id);

  const groups = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of bookings.data ?? []) {
      const key = berlinIsoDate(new Date(booking.startsAt));
      map.set(key, [...(map.get(key) ?? []), booking]);
    }
    return [...map.entries()];
  }, [bookings.data]);

  useEffect(() => {
    if (!focusId || !bookings.data) return;
    const element = document.getElementById(`booking-${focusId}`);
    element?.scrollIntoView?.({ block: 'center' });
    element?.focus();
  }, [focusId, bookings.data]);

  async function handleCancel() {
    if (!toCancel) return;
    try {
      await cancel.mutateAsync(toCancel.id);
      toast.show(t('bookings.cancelled'));
      setToCancel(null);
    } catch (error) {
      toast.show(t(`errors.${errorCode(error)}`), 'error');
    }
  }

  return (
    <div className="screen">
      <div className="toolbar">
        <h2 className="toolbar__title">{t('bookings.title')}</h2>
        <div className="segmented" role="group" aria-label={t('bookings.range')}>
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              className="segmented__option"
              aria-pressed={range === value}
              onClick={() => setRange(value)}
            >
              {t(`bookings.range_${value}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="privacy-note">
        <Lock size={16} aria-hidden />
        {t('bookings.privacy')}
      </p>

      {bookings.isPending ? (
        <LoadingRegion />
      ) : bookings.isError ? (
        <ErrorState message={t('app.loadFailed')} onRetry={() => void bookings.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState title={t('bookings.empty')} body={t('bookings.emptyHint')} />
      ) : (
        groups.map(([day, items]) => (
          <section key={day} className="booking-day" aria-labelledby={`bookings-${day}`}>
            <h3 id={`bookings-${day}`} className="booking-day__title">
              {formatBerlinDate(items[0]!.startsAt, locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h3>
            <ul className="booking-list">
              {items.map((booking) => {
                const cancelled = booking.status !== 'confirmed';
                const canCancel = !cancelled && new Date(booking.startsAt) > now;
                const name = booking.contact?.fullName ?? '';
                const dateLabel = `${formatBerlinDate(booking.startsAt, locale)} ${formatBerlinTime(booking.startsAt, locale)}`;
                return (
                  <li key={booking.id}>
                    <article
                      id={`booking-${booking.id}`}
                      tabIndex={-1}
                      className={cx(
                        'booking',
                        cancelled && 'booking--cancelled',
                        booking.id === focusId && 'booking--focus',
                      )}
                    >
                      <div className="booking__time">
                        <span className="booking__clock">
                          {formatBerlinTime(booking.startsAt, locale)}
                        </span>
                        <span className="muted">{formatBerlinTime(booking.endsAt, locale)}</span>
                        {booking.visitType === 'video' ? (
                          <span className="booking__video">
                            <Video size={14} aria-hidden />
                            {t('slot.video')}
                          </span>
                        ) : null}
                      </div>
                      <div className="booking__main">
                        {booking.contact ? (
                          <p className="booking__name">
                            <UserRound size={16} aria-hidden />
                            {booking.contact.fullName}
                          </p>
                        ) : (
                          <p className="booking__name muted">{t('bookings.contactRemoved')}</p>
                        )}
                        {booking.forDependent ? (
                          <p className="booking__dependent">
                            {booking.dependentAgeGroup
                              ? t('bookings.forDependent', {
                                  age: ageGroup(booking.dependentAgeGroup),
                                })
                              : t('bookings.forDependentNoAge')}
                          </p>
                        ) : null}
                        <dl className="booking__facts">
                          {booking.contact ? (
                            <>
                              <div>
                                <dt>{t('bookings.phone')}</dt>
                                <dd>
                                  <a
                                    className="link"
                                    href={`tel:${booking.contact.phone.replace(/[^+\d]/g, '')}`}
                                    aria-label={t('bookings.call', { name })}
                                  >
                                    <Phone size={14} aria-hidden />
                                    {booking.contact.phone}
                                  </a>
                                </dd>
                              </div>
                              <div>
                                <dt>{t('bookings.insurance')}</dt>
                                <dd>{t(`bookings.insurance_${booking.contact.insurance}`)}</dd>
                              </div>
                            </>
                          ) : null}
                          <div>
                            <dt>{t('bookings.reason')}</dt>
                            <dd>
                              {booking.reasonCategory
                                ? reason(booking.reasonCategory)
                                : t('bookings.noReason')}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('bookings.doctor')}</dt>
                            <dd>{doctorName(booking.doctorId)}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="booking__side">
                        <span className={cx('pill', `pill--${booking.status}`)}>
                          {t(`bookings.status_${booking.status}`)}
                        </span>
                        {canCancel ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<XCircle size={18} />}
                            aria-label={t('bookings.cancelA11y', { name, date: dateLabel })}
                            onClick={() => setToCancel(booking)}
                          >
                            {t('bookings.cancel')}
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Dialog
        open={toCancel !== null}
        title={t('bookings.cancelTitle')}
        onClose={() => setToCancel(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setToCancel(null)}>
              {t('app.cancel')}
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => void handleCancel()}>
              {t('bookings.cancelConfirm')}
            </Button>
          </>
        }
      >
        {toCancel ? (
          <>
            <p className="dialog__lead">
              {toCancel.contact?.fullName} ·{' '}
              {formatBerlinDate(toCancel.startsAt, locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              , {formatBerlinTime(toCancel.startsAt, locale)}
            </p>
            <p>{t('bookings.cancelBody')}</p>
          </>
        ) : null}
      </Dialog>
    </div>
  );
}
