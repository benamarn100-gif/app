import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from '../lib/cx';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  icon?: ReactNode;
  loading?: boolean;
};

/** Ruhige Lade-Anzeige statt Spinner (wie in der App). */
export function LoadingDots({ className }: { className?: string }) {
  return (
    <span className={cx('dots', className)} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  children,
  className,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={cx('btn', `btn--${variant}`, size === 'sm' && 'btn--sm', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {icon ? (
        <span className="btn__icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      {children ? <span className="btn__label">{children}</span> : null}
      {loading ? <LoadingDots /> : null}
    </button>
  );
}

/** Nur-Icon-Schaltfläche; `label` ist Pflicht (Screenreader, Tooltip). */
export function IconButton({
  label,
  icon,
  className,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { label: string; icon: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx('icon-btn', className)}
      aria-label={label}
      title={label}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}
