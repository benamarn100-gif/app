import { useQuery } from '@tanstack/react-query';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { ErrorState, LoadingRegion } from '../components/Feedback';
import { useRepository } from '../data/RepositoryContext';
import { errorCode } from '../data/types';
import { useT } from '../i18n';
import { AuthLayout } from './LoginScreen';

/** Zweiter Faktor (TOTP): Einrichtung beim ersten Mal, danach nur Code-Eingabe. */
export function MfaScreen({ enrolled }: { enrolled: boolean }) {
  const repo = useRepository();
  const { t } = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enrollment = useQuery({
    queryKey: ['mfa-enrollment'],
    queryFn: () => repo.auth.startTotpEnrollment(),
    enabled: !enrolled,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(t('login.codeInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.auth.verifyTotp(code, enrollment.data?.factorId);
    } catch (err) {
      setError(t(`errors.${errorCode(err)}`));
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <section className="auth__card" aria-labelledby="mfa-title">
        <h1 id="mfa-title" className="auth__title">
          {t('mfa.title')}
        </h1>
        <p className="auth__body">{enrolled ? t('mfa.verifyBody') : t('mfa.enrollBody')}</p>
        {!enrolled ? (
          enrollment.isPending ? (
            <LoadingRegion />
          ) : enrollment.isError ? (
            <ErrorState
              message={t(`errors.${errorCode(enrollment.error)}`)}
              onRetry={() => void enrollment.refetch()}
            />
          ) : (
            <div className="mfa__setup">
              <img
                className="mfa__qr"
                src={enrollment.data.qrCode}
                alt={t('mfa.qrAlt')}
                width={184}
                height={184}
              />
              <p className="auth__hint">{t('mfa.secretLabel')}</p>
              <code className="mfa__secret">{enrollment.data.secret}</code>
            </div>
          )
        ) : null}
        <form className="form" onSubmit={handleSubmit} noValidate>
          <Field label={t('mfa.code')} error={error}>
            {(props) => (
              <input
                {...props}
                className="input input--code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            )}
          </Field>
          <Button
            type="submit"
            loading={busy}
            icon={<ShieldCheck size={20} />}
            className="btn--block"
            disabled={!enrolled && !enrollment.data}
          >
            {t('mfa.confirm')}
          </Button>
          <Button
            variant="ghost"
            icon={<LogOut size={18} />}
            onClick={() => void repo.auth.signOut()}
          >
            {t('app.signOut')}
          </Button>
        </form>
      </section>
    </AuthLayout>
  );
}
