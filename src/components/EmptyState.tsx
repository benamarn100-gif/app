import type { ReactNode } from 'react';
import { View } from 'react-native';

import { makeStyles } from '@/design/theme';

import { Button } from './Button';
import { Text } from './Text';

type Action = { label: string; onPress: () => void; testID?: string };

type Props = {
  illustration?: ReactNode;
  title: string;
  body?: string;
  primaryAction?: Action;
  secondaryAction?: Action;
  tone?: 'neutral' | 'error';
  testID?: string;
};

/** Leer- und Fehlerzustand: Illustration + Klartext + nächste mögliche Aktion. */
export function EmptyState({
  illustration,
  title,
  body,
  primaryAction,
  secondaryAction,
  tone = 'neutral',
  testID,
}: Props) {
  const styles = useStyles();
  return (
    <View
      style={styles.container}
      testID={testID}
      accessibilityLiveRegion={tone === 'error' ? 'polite' : 'none'}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
    >
      {illustration}
      <View style={styles.texts}>
        <Text variant="h3" align="center">
          {title}
        </Text>
        {body ? (
          <Text variant="body" color="textSecondary" align="center">
            {body}
          </Text>
        ) : null}
      </View>
      {primaryAction || secondaryAction ? (
        <View style={styles.actions}>
          {primaryAction ? (
            <Button
              label={primaryAction.label}
              onPress={primaryAction.onPress}
              testID={primaryAction.testID}
            />
          ) : null}
          {secondaryAction ? (
            <Button
              variant="secondary"
              label={secondaryAction.label}
              onPress={secondaryAction.onPress}
              testID={secondaryAction.testID}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    alignItems: 'center',
    gap: t.space.lg,
    paddingVertical: t.space.xxl,
    paddingHorizontal: t.space.md,
  },
  texts: { gap: t.space.xs, maxWidth: 420 },
  actions: { gap: t.space.sm, alignSelf: 'stretch', maxWidth: 420, width: '100%' },
}));
