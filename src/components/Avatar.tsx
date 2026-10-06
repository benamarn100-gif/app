import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { makeStyles, useTheme } from '@/design/theme';
import { hashString } from '@/domain/seed/random';

import { Text } from './Text';

type Props = {
  name: string;
  size?: number;
  photoUrl?: string | null;
  blurhash?: string | null;
};

/** Initialen ohne Titel („Dr. med.“), max. 2 Buchstaben. */
export function initialsOf(name: string): string {
  const words = name
    .replace(/\b(Dr|med|Prof|dent|Dipl|Psych)\.?\s*/gi, ' ')
    .split(/[\s-]+/)
    .filter((w) => /^[A-Za-zÄÖÜäöüß]/.test(w) && !/^(am|im|an|der|die|das|und|für|von)$/i.test(w));
  const first = words[0]?.[0] ?? '';
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : (words[0]?.[1] ?? '');
  return (first + second).toUpperCase();
}

/** Avatar: Foto (mit Blurhash) oder Initialen auf weichem Farbverlauf. */
export function Avatar({ name, size = 48, photoUrl, blurhash }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const radius = size / 2;
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        placeholder={blurhash ? { blurhash } : undefined}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        transition={theme.motion.duration.base}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  }
  const palettes: [string, string][] = [
    [theme.colors.primarySoft, theme.colors.blobTeal],
    [theme.colors.accentSoft, theme.colors.blobCoral],
    [theme.colors.blobSand, theme.colors.primarySoft],
  ];
  const [from, to] = palettes[hashString(name) % palettes.length] ?? palettes[0]!;
  return (
    <View
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fill, { borderRadius: radius }]}
      />
      <View style={[styles.fill, styles.center]}>
        <Text
          variant={size >= 64 ? 'h2' : 'smallStrong'}
          style={{ fontSize: Math.round(size * 0.36) }}
          maxFontSizeMultiplier={1.2}
        >
          {initialsOf(name)}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
}));
