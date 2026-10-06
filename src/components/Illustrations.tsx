import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/design/theme';

/**
 * Eigene, warme Flat-Illustrationen mit organischen Formen (keine Stockfotos,
 * keine Fremd-Assets). Rein dekorativ → für Screenreader ausgeblendet.
 */

const BLOB_A =
  'M60,-58C76,-42,86,-21,85,-1C84,19,72,38,56,52C40,66,20,75,-2,77C-24,79,-48,74,-62,60C-76,46,-80,23,-79,1C-78,-21,-72,-42,-58,-58C-44,-74,-22,-85,-1,-84C20,-83,44,-74,60,-58Z';
const BLOB_B =
  'M52,-63C66,-50,75,-33,79,-14C83,5,82,26,71,41C60,56,40,66,19,72C-2,78,-24,80,-42,71C-60,62,-74,42,-79,21C-84,0,-80,-22,-69,-40C-58,-58,-40,-72,-20,-77C0,-82,38,-76,52,-63Z';

type IllustrationProps = { size?: number };

function Frame({ size = 160, children }: { size?: number; children: React.ReactNode }) {
  return (
    <View
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {children}
      </Svg>
    </View>
  );
}

export function IllustrationWelcome({ size }: IllustrationProps) {
  const { colors } = useTheme();
  return (
    <Frame size={size}>
      <G transform="translate(100 104)">
        <Path d={BLOB_A} fill={colors.blobTeal} />
      </G>
      <G transform="translate(150 60) scale(0.32)">
        <Path d={BLOB_B} fill={colors.blobCoral} />
      </G>
      {/* Standort-Pin mit Herz */}
      <Path
        d="M100 40c-24 0-42 18-42 41 0 30 42 74 42 74s42-44 42-74c0-23-18-41-42-41z"
        fill={colors.primary}
      />
      <Path
        d="M100 98c-1.2 0-14-8.6-14-18.4 0-5.3 4.1-9.6 9.2-9.6 2.2 0 4 1 4.8 2.4.8-1.4 2.6-2.4 4.8-2.4 5.1 0 9.2 4.3 9.2 9.6 0 9.8-12.8 18.4-14 18.4z"
        fill={colors.accent}
      />
      <Path
        d="M70 166c10 6 50 6 60 0"
        stroke={colors.borderStrong}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
    </Frame>
  );
}

export function IllustrationCalendar({ size }: IllustrationProps) {
  const { colors } = useTheme();
  return (
    <Frame size={size}>
      <G transform="translate(100 104)">
        <Path d={BLOB_B} fill={colors.blobSand} />
      </G>
      <Rect x={50} y={52} width={100} height={92} rx={18} fill={colors.surface} />
      <Path d="M50 70c0-10 8-18 18-18h64c10 0 18 8 18 18v6H50z" fill={colors.primary} />
      <Rect x={70} y={42} width={8} height={20} rx={4} fill={colors.textPrimary} />
      <Rect x={122} y={42} width={8} height={20} rx={4} fill={colors.textPrimary} />
      <Circle cx={100} cy={110} r={22} fill={colors.statusFreeSoft} />
      <Path
        d="M89 110l8 8 15-16"
        stroke={colors.statusFree}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={156} cy={60} r={10} fill={colors.accent} />
    </Frame>
  );
}

export function IllustrationSearchEmpty({ size }: IllustrationProps) {
  const { colors } = useTheme();
  return (
    <Frame size={size}>
      <G transform="translate(96 104)">
        <Path d={BLOB_A} fill={colors.blobTeal} />
      </G>
      <Circle
        cx={92}
        cy={92}
        r={36}
        fill={colors.surface}
        stroke={colors.primary}
        strokeWidth={10}
      />
      <Path d="M118 118l28 28" stroke={colors.primary} strokeWidth={12} strokeLinecap="round" />
      <Path
        d="M80 92c4-10 16-14 24-8"
        stroke={colors.accent}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M150 48c-10 2-16 12-14 22 10-2 16-12 14-22z"
        fill={colors.statusFree}
        opacity={0.7}
      />
    </Frame>
  );
}

export function IllustrationWaiting({ size }: IllustrationProps) {
  const { colors } = useTheme();
  return (
    <Frame size={size}>
      <G transform="translate(100 104)">
        <Path d={BLOB_B} fill={colors.blobCoral} />
      </G>
      {/* Glocke */}
      <Path
        d="M100 48c-20 0-34 16-34 36v22l-10 14h88l-10-14V84c0-20-14-36-34-36z"
        fill={colors.primary}
      />
      <Circle cx={100} cy={134} r={10} fill={colors.accent} />
      <Path
        d="M150 70c6 6 8 16 6 24M50 70c-6 6-8 16-6 24"
        stroke={colors.primary}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
    </Frame>
  );
}

export function IllustrationOffline({ size }: IllustrationProps) {
  const { colors } = useTheme();
  return (
    <Frame size={size}>
      <G transform="translate(100 104)">
        <Path d={BLOB_A} fill={colors.blobSand} />
      </G>
      <Path
        d="M66 128h70c14 0 24-10 24-23s-10-23-23-23c-3-17-17-29-35-29-16 0-30 11-34 26-13 2-22 12-22 25 0 14 9 24 20 24z"
        fill={colors.surface}
        stroke={colors.borderStrong}
        strokeWidth={4}
      />
      <Path d="M70 60l66 76" stroke={colors.accent} strokeWidth={8} strokeLinecap="round" />
    </Frame>
  );
}

export function IllustrationPractice({ size }: IllustrationProps) {
  const { colors } = useTheme();
  return (
    <Frame size={size}>
      <G transform="translate(100 108)">
        <Path d={BLOB_B} fill={colors.blobTeal} />
      </G>
      <Path d="M50 90l50-36 50 36v64H50z" fill={colors.surface} />
      <Path
        d="M44 92l56-42 56 42"
        stroke={colors.primary}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Rect x={88} y={118} width={24} height={36} rx={6} fill={colors.primary} />
      <Rect x={62} y={104} width={18} height={18} rx={5} fill={colors.blobSand} />
      <Rect x={120} y={104} width={18} height={18} rx={5} fill={colors.blobSand} />
      <Circle cx={100} cy={86} r={9} fill={colors.accent} />
      <Path
        d="M160 140c-12 0-18 8-18 14h28c0-6-4-14-10-14z"
        fill={colors.statusFree}
        opacity={0.6}
      />
    </Frame>
  );
}

export function IllustrationSuccessHalo({ size }: IllustrationProps) {
  const { colors } = useTheme();
  return (
    <Frame size={size}>
      <G transform="translate(100 100)">
        <Path d={BLOB_A} fill={colors.blobTeal} />
      </G>
      <G transform="translate(156 52) scale(0.22)">
        <Path d={BLOB_B} fill={colors.blobCoral} />
      </G>
      <G transform="translate(44 150) scale(0.18)">
        <Path d={BLOB_A} fill={colors.blobSand} />
      </G>
    </Frame>
  );
}

/**
 * Signature-Moment 1: weicher Start mit organischen Farbflächen, die langsam
 * atmen. Bei „Bewegung reduzieren“ statisch.
 */
export function OrganicBackground() {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduce, t]);
  const a = useAnimatedStyle(() => ({
    transform: [
      { translateX: -20 + t.value * 30 },
      { translateY: t.value * 18 },
      { scale: 1 + t.value * 0.06 },
    ],
  }));
  const b = useAnimatedStyle(() => ({
    transform: [
      { translateX: 10 - t.value * 24 },
      { translateY: -t.value * 22 },
      { scale: 1.04 - t.value * 0.06 },
    ],
  }));
  const c = useAnimatedStyle(() => ({
    transform: [{ translateY: t.value * 14 }, { rotate: `${t.value * 8}deg` }],
  }));
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[{ position: 'absolute', top: -80, left: -90, opacity: 0.9 }, a]}>
        <Svg width={340} height={340} viewBox="-100 -100 200 200">
          <Path d={BLOB_A} fill={colors.blobTeal} />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: 140, right: -110, opacity: 0.8 }, b]}>
        <Svg width={280} height={280} viewBox="-100 -100 200 200">
          <Path d={BLOB_B} fill={colors.blobCoral} />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', bottom: -60, left: 20, opacity: 0.9 }, c]}>
        <Svg width={300} height={240} viewBox="-100 -100 200 200">
          <Path d={BLOB_A} fill={colors.blobSand} />
        </Svg>
      </Animated.View>
    </View>
  );
}
