import { ChevronLeft, ChevronRight, Plus, Video } from 'lucide-react';
import { useMemo, useState } from 'react';

import { isSlotBookable, summarizeSlots } from '@app/domain/availability/status';
import type { Doctor, Practice } from '@app/domain/types';

import { Button, IconButton } from '../components/Button';
import { ErrorState, Skeleton } from '../components/Feedback';
import { FreshnessLabel } from '../components/FreshnessLabel';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { useConfirmAvailability, useToday, useWeek } from '../data/queries';
import { errorCode, type DashboardSlot } from '../data/types';
import { useT } from '../i18n';
import { cx } from '../lib/cx';
import {
  addBerlinDays,
  berlinIsoDate,
  formatBerlinDate,
  formatBerlinTime,
  isoWeekNumber,
  startOfBerlinWeek,
} from '../lib/time';
import { useNow } from '../lib/useNow';
import { NewSlotDialog } from './NewSlotDialog';
import { SlotDialog } from './SlotDialog';

export type SlotKind = 'open' | 'held' | 'booked' | 'external';

export function slotKind(slot: DashboardSlot, now: Date): SlotKind {
  if (slot.status === 'booked') return slot.appointmentId ? 'booked' : 'external';
  if (isSlotBookable(slot, now) || slot.status === 'open') return 'open';
  return 'held';
}

const KIND_LABEL = {
  open: 'week.open',
  held: 'week.held',
  booked: 'week.booked',
  external: 'week.bookedExternal',
} as const;

/** Kurzform für enge Spalten: „Dr. med. Anna Becker“ → „Dr. Becker“, „Anna Becker“ → „A. Becker“. */
export function shortName(doctor: Doctor | undefined): string {
  if (!doctor) return '';
  const parts = doctor.name.replace(/\bmed\.\s+/, '').split(/\s+/);
  const last = parts.at(-1) ?? doctor.name;
  if (parts[0] === 'Dr.') return `Dr. ${last}`;
  return parts.length > 1 ? `${parts[0]?.charAt(0)}. ${last}` : last;
}

export function WeekScreen({
  practice,
  onOpenBooking,
}: {
  practice: Practice;
  onOpenBooking: (appointmentId: string) => void;
}) {
  const { t, locale } = useT();
  const now = useNow();
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfBerlinWeek(new Date()));
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [newSlotDay, setNewSlotDay] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const week = useWeek(practice.id, weekStart);
  const today = useToday(practice.id);
  const confirm = useConfirmAvailability(practice.id);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addBerlinDays(weekStart, i)),
    [weekStart],
  );
  const doctors = useMemo(
    () => week.data?.doctors ?? today.data?.doctors ?? [],
    [week.data, today.data],
  );
  const doctorById = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);
  const slots = useMemo(
    () =>
      (week.data?.slots ?? []).filter((s) => doctorFilter === 'all' || s.doctorId === doctorFilter),
    [week.data, doctorFilter],
  );
  const byDay = useMemo(() => {
    const map = new Map<string, DashboardSlot[]>();
    for (const slot of slots) {
      const key = berlinIsoDate(new Date(slot.startsAt));
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return map;
  }, [slots]);

  const todayIso = berlinIsoDate(now);
  const todaySummary = today.data
    ? summarizeSlots(today.data.slots, 'today', today.data.lastSyncedAt, now)
    : null;
  const freeToday = (today.data?.slots ?? []).filter((s) => isSlotBookable(s, now)).length;
  const freeWeek = slots.filter((s) => isSlotBookable(s, now)).length;
  const bookedWeek = slots.filter((s) => s.status === 'booked' && s.appointmentId).length;
  const selected = week.data?.slots.find((s) => s.id === selectedId) ?? null;
  const isCurrentWeek = startOfBerlinWeek(now).getTime() === weekStart.getTime();
  const dateFormat = { day: 'numeric', month: 'short' } as const;

  async function handleConfirm() {
    try {
      await confirm.mutateAsync();
      toast.show(t('freshness.confirmed'));
    } catch (error) {
      toast.show(t(`errors.${errorCode(error)}`), 'error');
    }
  }

  return (
    <div className="screen">
      <section className="overview" aria-label={t('week.publicStatus')}>
        <div className="stat">
          <span className="stat__label">{t('week.freeToday')}</span>
          <span className="stat__value">{today.data ? freeToday : '–'}</span>
        </div>
        <div className="stat">
          <span className="stat__label">{t('week.freeWeek')}</span>
          <span className="stat__value">{week.data ? freeWeek : '–'}</span>
        </div>
        <div className="stat">
          <span className="stat__label">{t('week.bookedWeek')}</span>
          <span className="stat__value">{week.data ? bookedWeek : '–'}</span>
        </div>
        <div className="stat stat--public">
          <span className="stat__label">{t('week.publicStatus')}</span>
          <div className="stat__row">
            {todaySummary ? <StatusBadge status={todaySummary.status} /> : <Skeleton />}
            <FreshnessLabel lastSyncedAt={today.data?.lastSyncedAt ?? null} now={now} />
          </div>
          <div className="stat__row">
            <Button
              variant="secondary"
              size="sm"
              loading={confirm.isPending}
              onClick={() => void handleConfirm()}
            >
              {t('freshness.confirm')}
            </Button>
          </div>
          <p className="stat__hint">{t('freshness.hint')}</p>
        </div>
      </section>

      <div className="toolbar">
        <div className="toolbar__group">
          <div className="week-nav">
            <IconButton
              label={t('week.previous')}
              icon={<ChevronLeft size={20} />}
              onClick={() => setWeekStart((w) => addBerlinDays(w, -7))}
            />
            <h2 className="toolbar__title" aria-live="polite">
              {t('week.range', {
                week: isoWeekNumber(weekStart),
                from: formatBerlinDate(weekStart, locale, dateFormat),
                to: formatBerlinDate(addBerlinDays(weekStart, 6), locale, dateFormat),
              })}
            </h2>
            <IconButton
              label={t('week.next')}
              icon={<ChevronRight size={20} />}
              onClick={() => setWeekStart((w) => addBerlinDays(w, 7))}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={isCurrentWeek}
            onClick={() => setWeekStart(startOfBerlinWeek(new Date()))}
          >
            {t('week.today')}
          </Button>
        </div>
        <div className="toolbar__group">
          <label className="inline-field">
            <span>{t('week.doctorFilter')}</span>
            <select
              className="input input--select"
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
            >
              <option value="all">{t('week.allDoctors')}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            icon={<Plus size={20} />}
            onClick={() => setNewSlotDay(isCurrentWeek ? now : weekStart)}
          >
            {t('week.addSlot')}
          </Button>
        </div>
      </div>

      {week.isError && !week.data ? (
        <ErrorState message={t('app.loadFailed')} onRetry={() => void week.refetch()} />
      ) : (
        <div className="week" aria-busy={week.isFetching}>
          {days.map((day) => {
            const iso = berlinIsoDate(day);
            const daySlots = byDay.get(iso) ?? [];
            const isPast = iso < todayIso;
            const label = formatBerlinDate(day, locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            });
            return (
              <section
                key={iso}
                className={cx('day', iso === todayIso && 'day--today', isPast && 'day--past')}
                aria-labelledby={`day-${iso}`}
              >
                <header className="day__header">
                  <h3 id={`day-${iso}`} className="day__title">
                    <span className="day__weekday">
                      {formatBerlinDate(day, locale, { weekday: 'short' })}
                    </span>
                    <span className="day__date">{formatBerlinDate(day, locale, dateFormat)}</span>
                    <span className="visually-hidden">{label}</span>
                  </h3>
                  {!isPast ? (
                    <IconButton
                      className="day__add"
                      label={`${t('week.addSlot')}: ${label}`}
                      icon={<Plus size={18} />}
                      onClick={() => setNewSlotDay(day)}
                    />
                  ) : null}
                </header>
                {!week.data ? (
                  <Skeleton lines={3} />
                ) : daySlots.length === 0 ? (
                  <p className="day__empty">{t('week.emptyDay')}</p>
                ) : (
                  <ul className="day__slots">
                    {daySlots.map((slot) => {
                      const kind = slotKind(slot, now);
                      const doctor = doctorById.get(slot.doctorId);
                      const time = formatBerlinTime(slot.startsAt, locale);
                      const past = new Date(slot.startsAt) <= now;
                      return (
                        <li key={slot.id}>
                          <button
                            type="button"
                            className={cx('slot', `slot--${kind}`, past && 'slot--past')}
                            onClick={() => setSelectedId(slot.id)}
                            aria-label={t('week.slotA11y', {
                              time,
                              doctor: doctor?.name ?? '',
                              status: t(KIND_LABEL[kind]),
                            })}
                          >
                            <span className="slot__time">{time}</span>
                            {doctorFilter === 'all' && doctors.length > 1 ? (
                              <span className="slot__doctor">{shortName(doctor)}</span>
                            ) : null}
                            <span className="slot__status">
                              {slot.visitType === 'video' ? <Video size={14} aria-hidden /> : null}
                              {t(KIND_LABEL[kind])}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <NewSlotDialog
        practice={practice}
        doctors={doctors}
        initialDay={newSlotDay}
        defaultDoctorId={doctorFilter === 'all' ? doctors[0]?.id : doctorFilter}
        onClose={() => setNewSlotDay(null)}
      />
      <SlotDialog
        practice={practice}
        slot={selected}
        doctor={selected ? doctorById.get(selected.doctorId) : undefined}
        onClose={() => setSelectedId(null)}
        onOpenBooking={(id) => {
          setSelectedId(null);
          onOpenBooking(id);
        }}
      />
    </div>
  );
}
