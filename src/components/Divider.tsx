import { View } from 'react-native';

import { useTheme } from '@/design/theme';

export function Divider({ inset = 0 }: { inset?: number }) {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.border, marginLeft: inset }} />;
}
