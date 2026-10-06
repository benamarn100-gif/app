import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useT } from '../i18n';
import { cx } from '../lib/cx';

type Variant = 'success' | 'error' | 'info';
type ToastAction = { label: string; onPress: () => void };
type ToastItem = { id: number; message: string; variant: Variant; action?: ToastAction };
type ToastApi = { show: (message: string, variant?: Variant, action?: ToastAction) => void };

const ToastContext = createContext<ToastApi | null>(null);
const ICONS = { success: CircleCheck, error: CircleAlert, info: Info } as const;
const DURATION_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const { t } = useT();

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback<ToastApi['show']>(
    (message, variant = 'success', action) => {
      counter.current += 1;
      const id = counter.current;
      setItems((current) => [...current.slice(-2), { id, message, variant, action }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => {
          const Icon = ICONS[item.variant];
          return (
            <div key={item.id} className={cx('toast', `toast--${item.variant}`)}>
              <Icon className="toast__icon" size={20} aria-hidden />
              <p className="toast__message">{item.message}</p>
              {item.action ? (
                <button
                  type="button"
                  className="toast__action"
                  onClick={() => {
                    item.action?.onPress();
                    dismiss(item.id);
                  }}
                >
                  {item.action.label}
                </button>
              ) : null}
              <button
                type="button"
                className="toast__close"
                aria-label={t('app.close')}
                onClick={() => dismiss(item.id)}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast() außerhalb von <ToastProvider>');
  return api;
}
