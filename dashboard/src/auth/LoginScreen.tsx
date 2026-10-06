import { ArrowRight, Mail } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { brand } from '@app/config/brand';

import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { LogoMark, ShieldIllustration } from '../components/Illustrations';
import { DemoBadge } from '../components/StatusBadge';
import { useRepository } from '../data/RepositoryContext';
import { errorCode } from '../data/types';
import { useT } from '../i18n';
import { LanguageSwitch } from '../screens/LanguageSwitch';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="auth">
      <div className="auth__blob auth__blob--teal" aria-hidden />
      <div className="auth__blob auth__blob--coral" aria-hidden />
      <header className="auth__header">
        <span className="brand">
          <LogoMark size={28} />
          <span className="brand__name">{brand.name}</span>
          <span className="brand__product">{t('app.title')}</span>
        </span>
        <LanguageSwitch />
      </header>
      <main className="auth__main" id="main">
        {children}
      </main>
    </div>
  );
}

export function LoginScreen({ notice }: { notice: string | null }) {
  const repo = useRepository();
  const { t } = useT();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(t(`errors.${errorCode(err)}`));
    } finally {
      setBusy(false);
    }
  }

  function handleSendCode(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError(t('login.emailInvalid'));
      return;
    }
    void run(async () => {
      await repo.auth.sendCode(value);
      setStep('code');
    });
  }

  function handleVerify(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(t('login.codeInvalid'));
      return;
    }
    void run(() => repo.auth.verifyCode(email.trim(), code));
  }

  return (
    <AuthLayout>
      <section className="auth__card" aria-labelledby="login-title">
        <div className="auth__art" aria-hidden>
          <ShieldIllustration />
        </div>
        <h1 id="login-title" className="auth__title">
          {t('login.title')}
        </h1>
        <p className="auth__body">{t('login.body')}</p>
        {notice ? (
          <p className="notice" role="status">
            {notice}
          </p>
        ) : null}

        {repo.mode === 'demo' ? (
          <div className="auth__demo">
            <p className="auth__demo-title">
              {t('login.demoTitle')} <DemoBadge />
            </p>
            <p className="auth__body">{t('login.demoBody')}</p>
            <Button
              icon={<ArrowRight size={20} />}
              onClick={() => void repo.auth.signInDemo?.()}
              className="btn--block"
            >
              {t('login.demoOpen')}
            </Button>
          </div>
        ) : step === 'email' ? (
          <form className="form" onSubmit={handleSendCode} noValidate>
            <Field label={t('login.email')} error={error}>
              {(props) => (
                <input
                  {...props}
                  className="input"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" loading={busy} icon={<Mail size={20} />} className="btn--block">
              {t('login.sendCode')}
            </Button>
            <p className="auth__hint">{t('login.access')}</p>
          </form>
        ) : (
          <form className="form" onSubmit={handleVerify} noValidate>
            <p className="auth__body" role="status">
              {t('login.codeSent', { email: email.trim() })}
            </p>
            <Field label={t('login.code')} error={error}>
              {(props) => (
                <input
                  {...props}
                  className="input input--code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              )}
            </Field>
            <Button type="submit" loading={busy} className="btn--block">
              {t('login.verify')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
            >
              {t('login.otherEmail')}
            </Button>
          </form>
        )}
      </section>
    </AuthLayout>
  );
}
