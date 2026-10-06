import { useState } from 'react';
import { View } from 'react-native';
import { CircleCheck, KeyRound, Mail } from 'lucide-react-native';

import { Button, Card, Text, TextField } from '@/components';
import { useVerifyEmail } from '@/data/hooks';
import { makeStyles, useTheme } from '@/design/theme';
import { useT } from '@/i18n/useT';

/**
 * Einmalige E-Mail-Bestätigung per 6-stelligem Code vor der ersten Buchung.
 * Die anonyme Sitzung wird dabei zum Konto (Nutzer-ID und Daten bleiben).
 */
export function EmailVerification({
  verified,
  email,
}: {
  verified: boolean;
  email: string | null;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useT();
  const { request, verify } = useVerifyEmail();
  const [address, setAddress] = useState(email ?? '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (verified) {
    return (
      <View style={styles.row} accessibilityLiveRegion="polite">
        <CircleCheck size={18} color={theme.colors.statusFree} strokeWidth={2.25} />
        <Text variant="smallStrong" color="statusFree">
          {t('booking.verified')}
          {email ? ` · ${email}` : ''}
        </Text>
      </View>
    );
  }

  return (
    <Card tone="muted" style={styles.card}>
      <Text variant="h3">{t('booking.verifyTitle')}</Text>
      <Text variant="small" color="textSecondary">
        {t('booking.verifyBody')}
      </Text>
      <TextField
        label={t('booking.email')}
        value={address}
        onChangeText={(v) => {
          setAddress(v.trim());
          setError(null);
        }}
        icon={Mail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        error={!sent ? error : null}
        testID="verify-email"
      />
      {!sent ? (
        <Button
          variant="secondary"
          label={t('booking.sendCode')}
          loading={request.isPending}
          onPress={async () => {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
              setError(t('booking.emailInvalid'));
              return;
            }
            try {
              await request.mutateAsync(address);
              setSent(true);
            } catch {
              setError(t('booking.emailInvalid'));
            }
          }}
        />
      ) : (
        <>
          <Text variant="small" color="textSecondary" accessibilityLiveRegion="polite">
            {t('booking.codeSent', { email: address })}
          </Text>
          <TextField
            label={t('booking.code')}
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, '').slice(0, 6));
              setError(null);
            }}
            icon={KeyRound}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            error={error}
            testID="verify-code"
          />
          <Button
            variant="secondary"
            label={t('booking.verify')}
            disabled={code.length !== 6}
            loading={verify.isPending}
            onPress={async () => {
              try {
                await verify.mutateAsync({ email: address, code });
              } catch {
                setError(t('booking.codeInvalid'));
              }
            }}
          />
        </>
      )}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
}));
