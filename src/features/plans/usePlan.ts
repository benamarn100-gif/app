import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useRepository } from '@/data/DataProvider';
import { queryKeys } from '@/data/queryKeys';
import { can, higherPlan, PLAN_LIMITS, type Feature, type PlanId } from '@/domain/plans';
import { getBilling } from '@/lib/billing';

export type PlanState = {
  plan: PlanId;
  expiresAt: string | null;
  trial: boolean;
  limits: (typeof PLAN_LIMITS)[PlanId];
  can: (feature: Feature) => boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

/**
 * Aktuelle Abo-Stufe. Server (get_my_plan) ist die Wahrheit für Grenzen; direkt nach einem
 * Kauf zählt zusätzlich der Store-Stand, bis der Webhook angekommen ist. Ohne Netz: zuletzt
 * bekannte Stufe aus dem Cache, sonst „kostenlos“ – nie eine Sperre der Grundfunktionen.
 */
export function usePlan(): PlanState {
  const repo = useRepository();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.plan,
    queryFn: async () => {
      const billing = getBilling(repo);
      if (billing.kind === 'store') {
        const session = await repo.ensureSession();
        await billing.identify(session.userId).catch(() => undefined);
      }
      const [server, local] = await Promise.all([
        repo.getPlan(),
        billing.localPlan().catch(() => null),
      ]);
      const plan = local ? higherPlan(server.plan, local.plan) : server.plan;
      return {
        plan,
        expiresAt: (local?.plan === plan ? local.expiresAt : server.expiresAt) ?? null,
        trial: local?.plan === plan ? local.trial : false,
      };
    },
    staleTime: 60_000,
  });
  const plan = query.data?.plan ?? 'free';
  const refresh = useCallback(async () => {
    await client.invalidateQueries({ queryKey: queryKeys.plan });
  }, [client]);
  return useMemo(
    () => ({
      plan,
      expiresAt: query.data?.expiresAt ?? null,
      trial: query.data?.trial ?? false,
      limits: PLAN_LIMITS[plan],
      can: (feature: Feature) => can(plan, feature),
      isLoading: query.isLoading,
      refresh,
    }),
    [plan, query.data, query.isLoading, refresh],
  );
}
