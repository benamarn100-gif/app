import { useT } from '../i18n';
import { useNow } from '../lib/useNow';
import { Button } from './Button';
import { Dialog } from './Dialog';

/** Warnt vor der automatischen Abmeldung und bietet an, angemeldet zu bleiben. */
export function IdleWarning({
  deadline,
  onStay,
  onSignOut,
}: {
  deadline: number | null;
  onStay: () => void;
  onSignOut: () => void;
}) {
  const { t, tp } = useT();
  const now = useNow(1000);
  const seconds = deadline ? Math.max(0, Math.ceil((deadline - now.getTime()) / 1000)) : 0;
  return (
    <Dialog
      open={deadline !== null}
      title={t('app.idleWarningTitle')}
      onClose={onStay}
      footer={
        <>
          <Button variant="ghost" onClick={onSignOut}>
            {t('app.signOut')}
          </Button>
          <Button onClick={onStay}>{t('app.staySignedIn')}</Button>
        </>
      }
    >
      <p>{tp('app.idleWarningBody', seconds)}</p>
    </Dialog>
  );
}
