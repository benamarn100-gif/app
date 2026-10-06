import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/design/theme';
import { fontFamily } from '@/design/tokens';
import { useOffers } from '@/data/hooks';
import { useT } from '@/i18n/useT';

/**
 * Native Tab-Bar (iOS UITabBar / Android Material). Die API heißt in SDK 57 noch
 * `unstable-native-tabs` – deshalb hier gekapselt (docs/decisions.md D-07).
 */
export function TabsLayout() {
  const theme = useTheme();
  const { t } = useT();
  const { data: offers } = useOffers();
  const pendingOffers = offers?.filter((o) => o.status === 'pending').length ?? 0;

  return (
    <NativeTabs
      tintColor={theme.colors.primary}
      iconColor={{ default: theme.colors.textSecondary, selected: theme.colors.primary }}
      backgroundColor={theme.colors.surface}
      indicatorColor={theme.colors.primarySoft}
      labelStyle={{
        default: { fontFamily: fontFamily.bodyMedium, color: theme.colors.textSecondary },
        selected: { fontFamily: fontFamily.bodyMedium, color: theme.colors.primary },
      }}
      badgeBackgroundColor={theme.colors.accent}
      badgeTextColor={theme.colors.textOnAccent}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="index" testID="tab-home">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="today" testID="tab-today">
        <NativeTabs.Trigger.Icon sf={{ default: 'bolt', selected: 'bolt.fill' }} md="bolt" />
        <NativeTabs.Trigger.Label>{t('tabs.today')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" testID="tab-search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>{t('tabs.search')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="appointments" testID="tab-appointments">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'calendar', selected: 'calendar' }}
          md="calendar_month"
        />
        <NativeTabs.Trigger.Label>{t('tabs.appointments')}</NativeTabs.Trigger.Label>
        {pendingOffers > 0 ? (
          <NativeTabs.Trigger.Badge>{String(pendingOffers)}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" testID="tab-profile">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="person"
        />
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
