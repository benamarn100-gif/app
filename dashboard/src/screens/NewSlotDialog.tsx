import { useId, useState, type FormEvent } from 'react';

import type { Doctor, Practice, VisitType } from '@app/domain/types';

import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Field } from '../components/Field';
import { useToast } from '../components/Toast';
import { useCreateSlot } from '../data/queries';
import { errorCode } from '../data/types';
import { useT } from '../i18n';
import { SLOT_LENGTHS } from '../lib/templates';
import { berlinDateTime, berlinHHMM, berlinIsoDate, dateFromIso } from '../lib/time';

function defaultTime(day: Date, now: Date): string {
  if (berlinIsoDate(day) !== berlinIsoDate(now)) return '09:00';
  const hour = Number(berlinHHMM(now).slice(0, 2)) + 1;
  return hour <= 19 ? `${String(hour).padStart(2, '0')}:00` : '19:30';
}

function NewSlotForm({
  formId,
  practice,
  doctors,
  day,
  defaultDoctorId,
  onDone,
}: {
  formId: string;
  practice: Practice;
  doctors: Doctor[];
  day: Date;
  defaultDoctorId: string | undefined;
  onDone: () => void;
}) {
  const { t } = useT();
  const toast = useToast();
  const create = useCreateSlot(practice.id);
  const now = new Date();
  const [doctorId, setDoctorId] = useState(defaultDoctorId ?? doctors[0]?.id ?? '');
  const [date, setDate] = useState(() => berlinIsoDate(day < now ? now : day));
  const [time, setTime] = useState(() => defaultTime(day, now));
  const [minutes, setMinutes] = useState<number>(15);
  const [visitType, setVisitType] = useState<VisitType>('in_person');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const startsAt = berlinDateTime(dateFromIso(date), time);
    if (!date || !time || startsAt.getTime() <= Date.now()) {
      setError(t('slot.pastInvalid'));
      return;
    }
    setError(null);
    try {
      const slot = await create.mutateAsync({ doctorId, startsAt, minutes, visitType });
      toast.show(slot.holdReason === 'waitlist_offer' ? t('slot.offered') : t('slot.created'));
      onDone();
    } catch (err) {
      setError(t(`errors.${errorCode(err)}`));
    }
  }

  return (
    <form id={formId} className="form" onSubmit={handleSubmit} noValidate>
      <Field label={t('slot.doctor')}>
        {(props) => (
          <select
            {...props}
            className="input input--select"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="form__row">
        <Field label={t('slot.date')}>
          {(props) => (
            <input
              {...props}
              className="input"
              type="date"
              min={berlinIsoDate(now)}
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('slot.time')}>
          {(props) => (
            <input
              {...props}
              className="input"
              type="time"
              step={300}
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('slot.duration')}>
          {(props) => (
            <select
              {...props}
              className="input input--select"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            >
              {SLOT_LENGTHS.map((m) => (
                <option key={m} value={m}>
                  {t('slot.minutes', { count: m })}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {practice.offersVideo ? (
        <fieldset className="choice">
          <legend className="field__label">{t('slot.visitType')}</legend>
          {(['in_person', 'video'] as const).map((value) => (
            <label key={value} className="choice__option">
              <input
                type="radio"
                name={`${formId}-visit`}
                value={value}
                checked={visitType === value}
                onChange={() => setVisitType(value)}
              />
              {value === 'video' ? t('slot.video') : t('slot.inPerson')}
            </label>
          ))}
        </fieldset>
      ) : null}
      {error ? (
        <p className="form__error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function NewSlotDialog({
  practice,
  doctors,
  initialDay,
  defaultDoctorId,
  onClose,
}: {
  practice: Practice;
  doctors: Doctor[];
  initialDay: Date | null;
  defaultDoctorId: string | undefined;
  onClose: () => void;
}) {
  const { t } = useT();
  const formId = useId();
  return (
    <Dialog
      open={initialDay !== null}
      title={t('slot.newTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('app.cancel')}
          </Button>
          <Button type="submit" form={formId}>
            {t('slot.create')}
          </Button>
        </>
      }
    >
      {initialDay ? (
        <NewSlotForm
          key={initialDay.toISOString()}
          formId={formId}
          practice={practice}
          doctors={doctors}
          day={initialDay}
          defaultDoctorId={defaultDoctorId}
          onDone={onClose}
        />
      ) : null}
    </Dialog>
  );
}
