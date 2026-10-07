import { useMemo } from 'react';

import { useDependents } from '@/data/hooks';
import { profilesFrom, SELF, type Profile } from '@/domain/profiles';
import { useT } from '@/i18n/useT';
import { useActiveProfile } from '@/state/activeProfile';
import { usePreferences } from '@/state/preferences';

/** „Ich“ + Familienprofile und das aktive Profil (fällt auf „Ich“ zurück, wenn gelöscht). */
export function useProfiles(): { profiles: Profile[]; active: Profile; hasFamily: boolean } {
  const { t } = useT();
  const dependents = useDependents();
  const selfAgeGroup = usePreferences(
    (s) => s.selfAgeGroup ?? (s.forWhom === 'self' ? s.ageGroup : null),
  );
  const activeId = useActiveProfile((s) => s.activeProfileId);
  return useMemo(() => {
    const profiles = profilesFrom(t('booking.patientSelf'), selfAgeGroup, dependents.data ?? []);
    const active = profiles.find((p) => p.id === activeId) ?? profiles[0]!;
    return { profiles, active, hasFamily: profiles.length > 1 || active.id !== SELF };
  }, [t, selfAgeGroup, dependents.data, activeId]);
}
