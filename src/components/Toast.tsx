import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react-native';

import { makeStyles, useTheme } from '@/design/theme';
import { useT } from '@/i18n/useT';
import { haptics } from '@/lib/haptics';

import { Text } from './Text';

export type ToastKind = 'success' | 'error' | 'info';
type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onPress: () => void };
};

type ToastApi = {
  show: (message: string, kind?: ToastKind, action?: ToastItem['action']) => void;
};

const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

/** Rückmeldungen am unteren Rand. Werden vorgelesen; Fehler mit Warn-Haptik. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id: number) => setItems((list) => list.filter((i) => i.id !== id)),
    [],
  );

  const show = useCallback<ToastApi['show']>((message, kind = 'info', action) => {
    const id = nextId.current++;
    setItems((list) => [...list.slice(-1), { id, kind, message, action }]);
    AccessibilityInfo.announceForAccessibility(message);
    if (kind === 'success') haptics.success();
    if (kind === 'error') haptics.warning();
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastHost items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastHost({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 88 }]}>
      {items.map((item) => (
        <ToastView key={item.id} item={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </View>
  );
}

export function ToastView({
  item,
  onDismiss,
}: {
  item: Omit<ToastItem, 'id'>;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const reduce = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onDismiss, item.kind === 'error' ? 7000 : 4500);
    return () => clearTimeout(timer);
  }, [item.kind, onDismiss]);

  const Icon = item.kind === 'success' ? CircleCheck : item.kind === 'error' ? CircleAlert : Info;
  const iconColor =
    item.kind === 'success'
      ? theme.colors.statusFree
      : item.kind === 'error'
        ? theme.colors.statusBooked
        : theme.colors.primary;
  const bg =
    item.kind === 'success'
      ? theme.colors.statusFreeSoft
      : item.kind === 'error'
        ? theme.colors.statusBookedSoft
        : theme.colors.primarySoft;

  return (
    <Animated.View
      entering={
        reduce
          ? FadeIn.duration(theme.motion.duration.fast)
          : FadeInUp.springify().damping(18).stiffness(220)
      }
      exiting={FadeOut.duration(theme.motion.duration.fast)}
      style={[styles.toast, { backgroundColor: bg }]}
      accessibilityRole={item.kind === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion={item.kind === 'error' ? 'assertive' : 'polite'}
    >
      <Icon size={20} color={iconColor} strokeWidth={2.25} />
      <Text variant="smallStrong" style={styles.message}>
        {item.message}
      </Text>
      {item.action ? (
        <Pressable
          onPress={() => {
            item.action?.onPress();
            onDismiss();
          }}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.action}
        >
          <Text variant="smallStrong" color="primary">
            {item.action.label}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('toast.dismiss')}
        hitSlop={10}
        style={styles.close}
      >
        <X size={18} color={theme.colors.textSecondary} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  host: {
    position: 'absolute',
    left: t.space.md,
    right: t.space.md,
    gap: t.space.xs,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    paddingVertical: t.space.sm,
    paddingLeft: t.space.md,
    paddingRight: t.space.xs,
    borderRadius: t.radius.md,
    boxShadow: t.shadows.lg,
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
  },
  message: { flex: 1 },
  action: { minHeight: 40, justifyContent: 'center', paddingHorizontal: t.space.xs },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
}));
