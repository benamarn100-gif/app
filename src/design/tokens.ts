/**
 * MedNow Design-Tokens – einzige Quelle für Farben, Abstände, Radien, Typografie,
 * Schatten und Bewegung. Keine React-Native-Importe (wird auch vom Web-Dashboard
 * und von scripts/check-contrast.ts genutzt).
 *
 * Kontrast-Anpassungen gegenüber der Vorgabe (minimal, geprüft mit
 * `npm run check:contrast`, WCAG 2.1 AA):
 *  - hell  statusFree     #15803D → #157D3C (4,36 → 4,53 auf statusFreeSoft)
 *  - hell  statusFew      #B45309 → #B15209 (4,42 → 4,53 auf statusFewSoft)
 *  - hell  statusUnknown  #64748B → #606F85 (4,24 → 4,56 auf surfaceMuted)
 *  - dunkel statusUnknown #64748B → #7F8EA3 (3,59 → 5,13 auf surface)
 *  - neu   borderStrong (≥ 3:1) für Bedienelement-Grenzen (Eingabefelder, Chips, Fokus).
 *          `border` bleibt dekorativ (Karten-Trennlinien) – WCAG 1.4.11 gilt dort nicht.
 */

export type ColorScheme = 'light' | 'dark';

export type ColorTokens = {
  background: string;
  surface: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  textOnAccent: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  focus: string;
  scrim: string;
  statusFree: string;
  statusFreeSoft: string;
  statusFew: string;
  statusFewSoft: string;
  statusBooked: string;
  statusBookedSoft: string;
  statusUnknown: string;
  statusUnknownSoft: string;
  skeletonBase: string;
  skeletonHighlight: string;
  /** Organische Hintergrundflächen (Signature-Moment „weicher Start“). */
  blobTeal: string;
  blobCoral: string;
  blobSand: string;
  mapPinHalo: string;
};

export const colors: Record<ColorScheme, ColorTokens> = {
  light: {
    background: '#F7F5F0',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF3F1',
    textPrimary: '#14211F',
    textSecondary: '#4A5A57',
    textOnPrimary: '#FFFFFF',
    textOnAccent: '#14211F',
    border: '#DCE4E1',
    borderStrong: '#729286',
    primary: '#0F766E',
    primaryPressed: '#0B5F59',
    primarySoft: '#DDF1EE',
    accent: '#FF7A59',
    accentSoft: '#FFE6DE',
    focus: '#0F766E',
    scrim: 'rgba(20, 33, 31, 0.45)',
    statusFree: '#157D3C',
    statusFreeSoft: '#DCF5E6',
    statusFew: '#B15209',
    statusFewSoft: '#FDEFD3',
    statusBooked: '#B42318',
    statusBookedSoft: '#FDE4E1',
    statusUnknown: '#606F85',
    statusUnknownSoft: '#EEF1F5',
    skeletonBase: '#E8EEEC',
    skeletonHighlight: '#F5F8F7',
    blobTeal: '#CDEBE6',
    blobCoral: '#FFD9CC',
    blobSand: '#EFE7D6',
    mapPinHalo: '#FFFFFF',
  },
  dark: {
    background: '#0B1413',
    surface: '#121E1C',
    surfaceMuted: '#1A2927',
    textPrimary: '#EAF3F1',
    textSecondary: '#A9BDB9',
    textOnPrimary: '#05211E',
    textOnAccent: '#14211F',
    border: '#26403C',
    borderStrong: '#477870',
    primary: '#5EEAD4',
    primaryPressed: '#2DD4BF',
    primarySoft: '#0F3B36',
    accent: '#FF7A59',
    accentSoft: '#3A2219',
    focus: '#5EEAD4',
    scrim: 'rgba(0, 0, 0, 0.6)',
    statusFree: '#4ADE80',
    statusFreeSoft: '#11301F',
    statusFew: '#FBBF24',
    statusFewSoft: '#33270C',
    statusBooked: '#F87171',
    statusBookedSoft: '#3B1717',
    statusUnknown: '#7F8EA3',
    statusUnknownSoft: '#1C2530',
    skeletonBase: '#1A2927',
    skeletonHighlight: '#24372F',
    blobTeal: '#0F3B36',
    blobCoral: '#3A2219',
    blobSand: '#1E2A22',
    mapPinHalo: '#0B1413',
  },
};

/** 4-pt-Raster. Nur diese Werte für Abstände verwenden. */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;
export type SpaceToken = keyof typeof space;

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const fontFamily = {
  headingSemiBold: 'PlusJakartaSans_600SemiBold',
  headingBold: 'PlusJakartaSans_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
} as const;

export type TypeVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'smallStrong'
  | 'caption'
  | 'label';

export const typography: Record<
  TypeVariant,
  { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number }
> = {
  display: {
    fontFamily: fontFamily.headingBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  h1: { fontFamily: fontFamily.headingBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  h2: { fontFamily: fontFamily.headingBold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontFamily: fontFamily.headingSemiBold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamily.bodyMedium, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: fontFamily.bodyMedium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fontFamily.bodyMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  label: { fontFamily: fontFamily.headingSemiBold, fontSize: 16, lineHeight: 24 },
};

/** Dynamic Type: bis 200 % ohne abgeschnittene Texte. */
export const maxFontScale = 2;

/**
 * Weiche, mehrschichtige Schatten (4–10 % Deckkraft, leicht Teal-getönt).
 * CSS-`boxShadow`-Syntax (React Native New Architecture).
 */
export const shadows: Record<ColorScheme, { sm: string; md: string; lg: string }> = {
  light: {
    sm: '0px 1px 2px rgba(15, 118, 110, 0.06), 0px 2px 6px rgba(20, 33, 31, 0.04)',
    md: '0px 2px 4px rgba(15, 118, 110, 0.06), 0px 8px 20px rgba(15, 118, 110, 0.08)',
    lg: '0px 4px 8px rgba(15, 118, 110, 0.06), 0px 16px 40px rgba(15, 118, 110, 0.10)',
  },
  dark: {
    sm: '0px 1px 2px rgba(0, 0, 0, 0.08), 0px 2px 6px rgba(0, 0, 0, 0.06)',
    md: '0px 2px 4px rgba(0, 0, 0, 0.08), 0px 8px 20px rgba(0, 0, 0, 0.10)',
    lg: '0px 4px 8px rgba(0, 0, 0, 0.08), 0px 16px 40px rgba(0, 0, 0, 0.10)',
  },
};

export const motion = {
  /** Feder für Drücken und Sheets. */
  spring: { damping: 18, stiffness: 220, mass: 1 },
  duration: { fast: 150, base: 220, slow: 300 },
  stagger: { step: 40, maxItems: 8 },
  pressScale: 0.97,
} as const;

export const layout = {
  /** Mindestgröße für Touch-Ziele (dp). */
  touchTarget: 48,
  maxContentWidth: 640,
  screenPadding: space.md,
  iconSize: { sm: 16, md: 20, lg: 24, xl: 32 },
} as const;

/**
 * Alle Text- und UI-Farbpaare, die im Interface vorkommen.
 * `kind: 'text'` → 4,5:1, `kind: 'ui'` → 3:1 (WCAG 2.1 AA, 1.4.3 / 1.4.11).
 * Neue Kombinationen in Komponenten müssen hier ergänzt werden.
 */
export type ContrastPair = {
  fg: keyof ColorTokens;
  bg: keyof ColorTokens;
  kind: 'text' | 'ui';
  usage: string;
};

export const contrastPairs: ContrastPair[] = [
  ...(['background', 'surface', 'surfaceMuted'] as const).flatMap((bg) => [
    { fg: 'textPrimary', bg, kind: 'text', usage: 'Fließtext/Überschriften' } as const,
    { fg: 'textSecondary', bg, kind: 'text', usage: 'Sekundärtext' } as const,
    { fg: 'primary', bg, kind: 'text', usage: 'Text-Button, Links' } as const,
    { fg: 'statusFree', bg, kind: 'text', usage: 'Status „frei“' } as const,
    { fg: 'statusFew', bg, kind: 'text', usage: 'Status „wenige“' } as const,
    { fg: 'statusBooked', bg, kind: 'text', usage: 'Status „ausgebucht“, Fehler' } as const,
    { fg: 'statusUnknown', bg, kind: 'text', usage: 'Status „unbekannt“' } as const,
    { fg: 'borderStrong', bg, kind: 'ui', usage: 'Rahmen Eingabefeld/Chip' } as const,
    { fg: 'focus', bg, kind: 'ui', usage: 'Fokusring' } as const,
  ]),
  { fg: 'textOnPrimary', bg: 'primary', kind: 'text', usage: 'Primär-Button' },
  { fg: 'textOnPrimary', bg: 'primaryPressed', kind: 'text', usage: 'Primär-Button gedrückt' },
  { fg: 'primary', bg: 'primarySoft', kind: 'text', usage: 'Sekundär-Button, ausgewählter Chip' },
  { fg: 'textPrimary', bg: 'primarySoft', kind: 'text', usage: 'Text auf weicher Primärfläche' },
  { fg: 'textOnAccent', bg: 'accent', kind: 'text', usage: 'Text auf Coral-Highlight' },
  { fg: 'textPrimary', bg: 'accentSoft', kind: 'text', usage: 'Hinweis-Karte' },
  { fg: 'statusFree', bg: 'statusFreeSoft', kind: 'text', usage: 'StatusBadge frei' },
  { fg: 'statusFew', bg: 'statusFewSoft', kind: 'text', usage: 'StatusBadge wenige' },
  {
    fg: 'statusBooked',
    bg: 'statusBookedSoft',
    kind: 'text',
    usage: 'StatusBadge ausgebucht, Fehler-Toast',
  },
  { fg: 'statusUnknown', bg: 'statusUnknownSoft', kind: 'text', usage: 'StatusBadge unbekannt' },
  { fg: 'textPrimary', bg: 'statusBookedSoft', kind: 'text', usage: 'Fehlermeldung' },
  { fg: 'textPrimary', bg: 'statusFreeSoft', kind: 'text', usage: 'Erfolgsmeldung' },
  { fg: 'primary', bg: 'surface', kind: 'ui', usage: 'Ausgewählter Zustand (Radio, Slot)' },
  { fg: 'textSecondary', bg: 'primarySoft', kind: 'text', usage: 'Hero-Karte Fließtext' },
  { fg: 'textSecondary', bg: 'accentSoft', kind: 'text', usage: 'Hinweis-Karte Sekundärtext' },
  { fg: 'textSecondary', bg: 'statusFreeSoft', kind: 'text', usage: 'Datenalter im Banner „frei“' },
  {
    fg: 'textSecondary',
    bg: 'statusFewSoft',
    kind: 'text',
    usage: 'Datenalter im Banner „wenige“',
  },
  {
    fg: 'textSecondary',
    bg: 'statusBookedSoft',
    kind: 'text',
    usage: 'Datenalter im Banner „ausgebucht“',
  },
  { fg: 'textPrimary', bg: 'statusFewSoft', kind: 'text', usage: 'Offline-Banner' },
  { fg: 'textPrimary', bg: 'statusUnknownSoft', kind: 'text', usage: 'Banner „unbekannt“' },
  { fg: 'textOnAccent', bg: 'accent', kind: 'text', usage: 'Tab-Badge (offene Angebote)' },
];
