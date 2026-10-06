import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, Modal, Platform, Pressable, View } from 'react-native';

import { makeStyles } from '@/design/theme';
import { useT } from '@/i18n/useT';

import { Button } from './Button';
import { Text } from './Text';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Unumkehrbare Aktion (Stornieren, Löschen): Bestätigen in Fehlerfarbe. */
  destructive?: boolean;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Rückfragen vor folgenreichen Aktionen. iOS/Android: System-Dialog (vertraut, mit
 * Screenreader-Unterstützung). Web: eigener Dialog – `Alert.alert` ist dort wirkungslos
 * und `window.confirm` in eingebetteten Ansichten oft blockiert.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const { t } = useT();
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        if (Platform.OS !== 'web') {
          Alert.alert(
            options.title,
            options.message,
            [
              {
                text: options.cancelLabel ?? t('common.cancel'),
                style: 'cancel',
                onPress: () => resolve(false),
              },
              {
                text: options.confirmLabel,
                style: options.destructive ? 'destructive' : 'default',
                onPress: () => resolve(true),
              },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
          );
          return;
        }
        resolver.current?.(false);
        resolver.current = resolve;
        setPending(options);
      }),
    [t],
  );

  const close = (confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setPending(null);
  };

  const value = useMemo(() => confirm, [confirm]);
  const cancelLabel = pending?.cancelLabel ?? t('common.cancel');

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => close(false)}>
          <View style={styles.backdrop}>
            <Pressable
              style={styles.scrim}
              onPress={() => close(false)}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            />
            <View style={styles.dialog} accessibilityViewIsModal testID="confirm-dialog">
              <Text variant="h3" accessibilityRole="header">
                {pending.title}
              </Text>
              {pending.message ? (
                <Text variant="body" color="textSecondary">
                  {pending.message}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Button
                  label={cancelLabel}
                  variant="secondary"
                  onPress={() => close(false)}
                  testID="confirm-cancel"
                />
                <Button
                  label={pending.confirmLabel}
                  error={pending.destructive}
                  onPress={() => close(true)}
                  testID="confirm-accept"
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm() außerhalb von <ConfirmProvider>');
  return confirm;
}

const useStyles = makeStyles((t) => ({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.space.lg,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.scrim,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    gap: t.space.md,
    padding: t.space.xl,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    boxShadow: t.shadows.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap-reverse',
    justifyContent: 'flex-end',
    gap: t.space.sm,
    marginTop: t.space.xs,
  },
}));
