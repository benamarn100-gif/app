import { Tabs } from 'expo-router';
import { CalendarDays, CircleUserRound, House, Search } from 'lucide-react-native';

import { useOffers } from '@/data/hooks';
import { useTheme } from '@/design/theme';
import { fontFamily } from '@/design/tokens';
import { useT } from '@/i18n/useT';

/**
 * Web-Vorschau (und Fallback für D-07): klassische Tab-Bar unten mit Lucide-Icons,
 * da die nativen Tabs im Web oben dargestellt werden.
 */
export function TabsLayout() {
  const theme = useTheme();
  const { t } = useT();
  const { data: offers } = useOffers();
  const pending = offers?.filter((o) => o.status === 'pending').length ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 64,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontFamily: fontFamily.bodyMedium, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => <House color={color} size={22} />,
          tabBarButtonTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.search'),
          tabBarIcon: ({ color }) => <Search color={color} size={22} />,
          tabBarButtonTestID: 'tab-search',
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: t('tabs.appointments'),
          tabBarIcon: ({ color }) => <CalendarDays color={color} size={22} />,
          tabBarBadge: pending || undefined,
          tabBarButtonTestID: 'tab-appointments',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <CircleUserRound color={color} size={22} />,
          tabBarButtonTestID: 'tab-profile',
        }}
      />
    </Tabs>
  );
}
