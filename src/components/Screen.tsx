import type { ReactNode } from 'react';
import {
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles } from '@/design/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Oben Safe-Area einrechnen (Screens ohne nativen Header). */
  edgeTop?: boolean;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ScrollViewProps['refreshControl'];
  testID?: string;
};

/** Bildschirmgerüst: Hintergrund, Safe Area, max. Inhaltsbreite (Tablets/Web), optionaler fixierter Footer. */
export function Screen({
  children,
  scroll = true,
  edgeTop,
  footer,
  contentStyle,
  refreshControl,
  testID,
}: Props) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const padTop = edgeTop ? insets.top + 8 : 0;
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;
  return (
    <View style={styles.root} testID={testID}>
      {scroll ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: padTop, paddingBottom: footer ? 24 : insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.fill, { paddingTop: padTop }]}>{content}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: t.layout.screenPadding,
    gap: t.space.xl,
  },
  footer: {
    paddingTop: t.space.sm,
    paddingHorizontal: t.layout.screenPadding,
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    boxShadow: t.shadows.lg,
  },
}));
