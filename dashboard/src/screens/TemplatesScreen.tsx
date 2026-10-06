import { CalendarPlus, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import type { Doctor, Practice, VisitType } from '@app/domain/types';

import { Button, IconButton } from '../components/Button';
import { ErrorState, LoadingRegion } from '../components/Feedback';
import { Field } from '../components/Field';
import { useToast } from '../components/Toast';
import {
  useAddTemplate,
  useApplyTemplates,
  useDeleteTemplate,
  useTemplates,
  useToday,
} from '../data/queries';
import { errorCode, type SlotTemplate } from '../data/types';
import { useT } from '../i18n';
import {
  expandTemplates,
  isValidRule,
  MAX_TEMPLATE_WEEKS,
  rulesOverlap,
  SLOT_LENGTHS,
} from '../lib/templates';
import {
  addBerlinDays,
  berlinIsoDate,
  dateFromIso,
  formatBerlinDate,
  isoWeekNumber,
  startOfBerlinWeek,
  weekdayName,
} from '../lib/time';
import { useNow } from '../lib/useNow';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

function TemplateForm({
  practice,
  doctors,
  templates,
}: {
  practice: Practice;
  doctors: Doctor[];
  templates: SlotTemplate[];
}) {
  const { t, locale } = useT();
  const toast = useToast();
  const add = useAddTemplate(practice.id);
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? '');
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [slotMinutes, setSlotMinutes] = useState(15);
  const [visitType, setVisitType] = useState<VisitType>('in_person');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input = {
      doctorId: doctorId || doctors[0]?.id || '',
      weekday,
      startTime,
      endTime,
      slotMinutes,
      visitType,
    };
    if (!isValidRule(input)) {
      setError(t('templates.rangeInvalid'));
      return;
    }
    if (templates.some((existing) => rulesOverlap(existing, input))) {
      setError(t('errors.template_overlap'));
      return;
    }
    setError(null);
    try {
      await add.mutateAsync(input);
      toast.show(t('templates.added'));
    } catch (err) {
      setError(t(`errors.${errorCode(err)}`));
    }
  }

  return (
    <form
      className="card form"
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="template-form-title"
    >
      <h3 id="template-form-title" className="card__title">
        {t('templates.addTitle')}
      </h3>
      <Field label={t('templates.doctor')}>
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
      <Field label={t('templates.weekday')}>
        {(props) => (
          <select
            {...props}
            className="input input--select"
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
          >
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {weekdayName(d, locale)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="form__row">
        <Field label={t('templates.from')}>
          {(props) => (
            <input
              {...props}
              className="input"
              type="time"
              step={300}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('templates.to')}>
          {(props) => (
            <input
              {...props}
              className="input"
              type="time"
              step={300}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('templates.slotLength')}>
          {(props) => (
            <select
              {...props}
              className="input input--select"
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Number(e.target.value))}
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
          <legend className="field__label">{t('templates.visitType')}</legend>
          {(['in_person', 'video'] as const).map((value) => (
            <label key={value} className="choice__option">
              <input
                type="radio"
                name="template-visit"
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
      <Button type="submit" icon={<Plus size={20} />} loading={add.isPending}>
        {t('templates.add')}
      </Button>
    </form>
  );
}

function ApplyPanel({ practice, templates }: { practice: Practice; templates: SlotTemplate[] }) {
  const { t, tp, locale } = useT();
  const toast = useToast();
  const now = useNow();
  const apply = useApplyTemplates(practice.id);
  // Wochenliste nur bei Wochenwechsel neu berechnen
  const weekKey = berlinIsoDate(startOfBerlinWeek(now));
  const mondays = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addBerlinDays(dateFromIso(weekKey), i * 7)),
    [weekKey],
  );
  const [fromDate, setFromDate] = useState(() => berlinIsoDate(mondays[0] ?? now));
  const [weeks, setWeeks] = useState(4);
  const planned = expandTemplates(templates, fromDate, weeks, now).length;

  async function handleApply() {
    try {
      const created = await apply.mutateAsync({ fromDate, weeks });
      toast.show(created > 0 ? tp('templates.applied', created) : t('templates.appliedNone'));
    } catch (error) {
      toast.show(t(`errors.${errorCode(error)}`), 'error');
    }
  }

  return (
    <section className="card form" aria-labelledby="apply-title">
      <h3 id="apply-title" className="card__title">
        {t('templates.applyTitle')}
      </h3>
      <div className="form__row">
        <Field label={t('templates.applyFrom')}>
          {(props) => (
            <select
              {...props}
              className="input input--select"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            >
              {mondays.map((monday) => (
                <option key={monday.toISOString()} value={berlinIsoDate(monday)}>
                  {t('templates.weekOption', {
                    week: isoWeekNumber(monday),
                    date: formatBerlinDate(monday, locale, { day: 'numeric', month: 'short' }),
                  })}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('templates.applyWeeks')}>
          {(props) => (
            <select
              {...props}
              className="input input--select"
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
            >
              {Array.from({ length: MAX_TEMPLATE_WEEKS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {tp('templates.weeks', n)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <p className="muted" aria-live="polite">
        {planned > 0 ? tp('templates.preview', planned) : t('templates.previewNone')}
      </p>
      <Button
        icon={<CalendarPlus size={20} />}
        disabled={planned === 0}
        loading={apply.isPending}
        onClick={() => void handleApply()}
      >
        {t('templates.apply')}
      </Button>
    </section>
  );
}

export function TemplatesScreen({ practice }: { practice: Practice }) {
  const { t, locale } = useT();
  const toast = useToast();
  const templates = useTemplates(practice.id);
  const doctors = useToday(practice.id).data?.doctors;
  const remove = useDeleteTemplate(practice.id);

  async function handleDelete(id: string) {
    try {
      await remove.mutateAsync(id);
      toast.show(t('templates.deleted'));
    } catch (error) {
      toast.show(t(`errors.${errorCode(error)}`), 'error');
    }
  }

  if (templates.isError) {
    return <ErrorState message={t('app.loadFailed')} onRetry={() => void templates.refetch()} />;
  }
  if (templates.isPending || !doctors) return <LoadingRegion />;

  return (
    <div className="screen">
      <div className="toolbar">
        <h2 className="toolbar__title">{t('templates.title')}</h2>
      </div>
      <p className="lead">{t('templates.intro')}</p>
      <div className="templates">
        <div className="templates__list">
          {doctors.map((doctor) => {
            const rules = templates.data
              .filter((rule) => rule.doctorId === doctor.id)
              .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
            return (
              <section key={doctor.id} className="card" aria-labelledby={`tpl-${doctor.id}`}>
                <h3 id={`tpl-${doctor.id}`} className="card__title">
                  {doctor.name}
                </h3>
                {rules.length === 0 ? (
                  <p className="muted">{t('templates.empty')}</p>
                ) : (
                  <ul className="rules">
                    {rules.map((rule) => {
                      const label = t('templates.rule', {
                        weekday: weekdayName(rule.weekday, locale),
                        from: rule.startTime,
                        to: rule.endTime,
                      });
                      return (
                        <li key={rule.id} className="rule">
                          <div>
                            <p className="rule__title">{label}</p>
                            <p className="muted">
                              {t('templates.ruleMeta', {
                                minutes: rule.slotMinutes,
                                visitType:
                                  rule.visitType === 'video' ? t('slot.video') : t('slot.inPerson'),
                              })}
                            </p>
                          </div>
                          <IconButton
                            label={t('templates.delete', { label })}
                            icon={<Trash2 size={18} />}
                            onClick={() => void handleDelete(rule.id)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <div className="templates__side">
          <TemplateForm practice={practice} doctors={doctors} templates={templates.data} />
          <ApplyPanel practice={practice} templates={templates.data} />
        </div>
      </div>
    </div>
  );
}
