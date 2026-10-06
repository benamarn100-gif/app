import { useEffect } from 'react';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Chip, Text, TextField } from '@/components';
import { Phone, User } from '@/components/icons';
import { makeStyles } from '@/design/theme';
import type { BookingContact } from '@/domain/types';
import { useT } from '@/i18n/useT';

export const contactSchema = z.object({
  fullName: z.string().trim().min(2, 'fullName').max(120, 'fullName'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()/-]{6,20}$/, 'phone'),
  insurance: z.enum(['public', 'private']),
});

type Props = {
  defaultValues?: BookingContact | null;
  onChange: (value: BookingContact | null) => void;
};

/** Kontakt für die Praxis (Name, Telefon, Versicherungsart) – mit vorgelesenen Fehlern. */
export function ContactForm({ defaultValues, onChange }: Props) {
  const styles = useStyles();
  const { t } = useT();
  const {
    control,
    watch,
    formState: { errors, isValid },
    reset,
  } = useForm<BookingContact>({
    resolver: zodResolver(contactSchema),
    mode: 'onTouched',
    defaultValues: defaultValues ?? { fullName: '', phone: '', insurance: 'public' },
  });

  useEffect(() => {
    if (defaultValues) reset(defaultValues, { keepDirtyValues: true });
  }, [defaultValues, reset]);

  const values = watch();
  useEffect(() => {
    const parsed = contactSchema.safeParse(values);
    onChange(parsed.success ? parsed.data : null);
  }, [values.fullName, values.phone, values.insurance, isValid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.container}>
      <Text variant="small" color="textSecondary">
        {t('booking.contactHint')}
      </Text>
      <Controller
        control={control}
        name="fullName"
        render={({ field }) => (
          <TextField
            label={t('booking.fullName')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            icon={User}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            error={errors.fullName ? t('booking.fullNameInvalid') : null}
            testID="contact-name"
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <TextField
            label={t('booking.phone')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            icon={Phone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            error={errors.phone ? t('booking.phoneInvalid') : null}
            testID="contact-phone"
          />
        )}
      />
      <Text variant="smallStrong">{t('booking.insurance')}</Text>
      <Controller
        control={control}
        name="insurance"
        render={({ field }) => (
          <View
            style={styles.row}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('booking.insurance')}
          >
            <Chip
              role="radio"
              label={t('filters.insurancePublic')}
              selected={field.value === 'public'}
              onPress={() => field.onChange('public')}
            />
            <Chip
              role="radio"
              label={t('filters.insurancePrivate')}
              selected={field.value === 'private'}
              onPress={() => field.onChange('private')}
            />
          </View>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: { gap: t.space.md },
  row: { flexDirection: 'row', gap: t.space.xs, flexWrap: 'wrap' },
}));
