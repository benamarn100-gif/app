import { ArrowRight, Trash2 } from 'lucide-react';

import type { Doctor, Practice } from '@app/domain/types';

import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/Toast';
import { useCancelSlot } from '../data/queries';
import { errorCode, type DashboardSlot } from '../data/types';
import { useT } from '../i18n';
import { formatBerlinDate, formatBerlinTime } from '../lib/time';
import { useNow } from '../lib/useNow';
import { slotKind } from './WeekScreen';

export function SlotDialog({
  practice,
  slot,
  doctor,
  onClose,
  onOpenBooking,
}: {
  practice: Practice;
  slot: DashboardSlot | null;
  doctor: Doctor | undefined;
  onClose: () => void;
  onOpenBooking: (appointmentId: string) => void;
}) {
  const { t, locale } = useT();
  const toast = useToast();
  const now = useNow();
  const cancel = useCancelSlot(practice.id);
  const kind = slot ? slotKind(slot, now) : 'open';
  const future = slot ? new Date(slot.startsAt) > now : false;
  const minutes = slot
    ? Math.round((new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60_000)
    : 0;
  const date = slot
    ? formatBerlinDate(slot.startsAt, locale, { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const time = slot ? formatBerlinTime(slot.startsAt, locale) : '';

  async function handleRemove() {
    if (!slot) return;
    try {
      await cancel.mutateAsync(slot.id);
      toast.show(t('slot.removed'));
      onClose();
    } catch (error) {
      toast.show(t(`errors.${errorCode(error)}`), 'error');
    }
  }

  const hint = {
    open: t('slot.openHint'),
    held: t('slot.heldHint'),
    booked: t('slot.bookedHint'),
    external: t('slot.externalHint'),
  }[kind];

  return (
    <Dialog
      open={slot !== null}
      title={t('slot.detailsTitle', { date, time })}
      onClose={onClose}
      footer={
        slot && kind === 'open' && future ? (
          <Button
            variant="danger"
            icon={<Trash2 size={18} />}
            loading={cancel.isPending}
            onClick={() => void handleRemove()}
          >
            {t('slot.remove')}
          </Button>
        ) : slot?.appointmentId ? (
          <Button
            icon={<ArrowRight size={18} />}
            onClick={() => slot.appointmentId && onOpenBooking(slot.appointmentId)}
          >
            {t('slot.openBooking')}
          </Button>
        ) : null
      }
    >
      {slot ? (
        <>
          <dl className="details">
            <div>
              <dt>{t('slot.doctor')}</dt>
              <dd>{doctor?.name}</dd>
            </div>
            <div>
              <dt>{t('slot.duration')}</dt>
              <dd>
                {formatBerlinTime(slot.startsAt, locale)}–{formatBerlinTime(slot.endsAt, locale)} ·{' '}
                {t('slot.minutes', { count: minutes })}
              </dd>
            </div>
            <div>
              <dt>{t('slot.visitType')}</dt>
              <dd>{slot.visitType === 'video' ? t('slot.video') : t('slot.inPerson')}</dd>
            </div>
          </dl>
          <p className={`slot-hint slot-hint--${kind}`}>{hint}</p>
          <p className="muted">{t(`slot.source_${slot.source}`)}</p>
        </>
      ) : null}
    </Dialog>
  );
}
