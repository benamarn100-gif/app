import { useEffect, useMemo, useRef } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { demoCity } from '@/config/env';
import { distanceMeters } from '@/domain/geo/distance';
import { addDays } from 'date-fns';
import { startOfBerlinDay } from '@/domain/time/berlin';
import type {
  AgeGroup,
  Appointment,
  AppointmentWithDetails,
  ConsentType,
  LatLng,
  PracticeAvailability,
  Slot,
} from '@/domain/types';
import { useT } from '@/i18n/useT';
import { hasLocationPermission, locateDevice, useDeviceLocation } from '@/lib/location';
import { getNow } from '@/lib/useNow';
import { usePreferences } from '@/state/preferences';

import { useRepository } from './DataProvider';
import { queryKeys } from './queryKeys';
import type { BookInput, SearchParams, WaitlistInput } from './repository';

// ---------------------------------------------------------------------------
// Suchmittelpunkt
// ---------------------------------------------------------------------------

export type SearchCenter = {
  center: LatLng | null;
  label: string;
  source: 'device' | 'postal' | 'demo' | 'none';
  /** Demo-Daten gibt es nur für die Demo-Stadt – Standort lag zu weit weg. */
  demoFallback: boolean;
  locating: boolean;
};

const DEMO_RANGE_M = 60_000;

export function useSearchCenter(): SearchCenter {
  const repo = useRepository();
  const { t } = useT();
  const saved = usePreferences((s) => s.location);
  const device = useDeviceLocation();

  useEffect(() => {
    if (saved?.kind !== 'device' || device.status !== 'idle') return;
    void hasLocationPermission().then((granted) => {
      if (granted) void locateDevice({ ask: false });
      else useDeviceLocation.setState({ status: 'denied' });
    });
  }, [saved, device.status]);

  return useMemo<SearchCenter>(() => {
    let center: LatLng | null = null;
    let source: SearchCenter['source'] = 'none';
    let label = t('location.unset');
    if (saved?.kind === 'postal') {
      center = { lat: saved.lat, lng: saved.lng };
      source = 'postal';
      label = t('location.postalCode', { code: saved.postalCode });
    } else if (saved?.kind === 'device' && device.coords) {
      center = device.coords;
      source = 'device';
      label = t('location.current');
    }
    let demoFallback = false;
    if (
      repo.mode === 'memory' &&
      (!center || distanceMeters(center, demoCity.center) > DEMO_RANGE_M)
    ) {
      demoFallback = center !== null;
      center = demoCity.center;
      source = 'demo';
      label = `${demoCity.name} (${t('app.demoBadge')})`;
    }
    return { center, label, source, demoFallback, locating: device.status === 'locating' };
  }, [saved, device.coords, device.status, repo.mode, t]);
}

// ---------------------------------------------------------------------------
// Öffentliche Daten
// ---------------------------------------------------------------------------

export function useAvailabilitySearch(
  params: SearchParams | null,
  options: { enabled?: boolean } = {},
) {
  const repo = useRepository();
  return useQuery({
    queryKey: params ? queryKeys.search(params) : ['availability', 'search', 'disabled'],
    queryFn: () => repo.search(params!, getNow()),
    enabled: !!params && options.enabled !== false,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function usePractice(id: string | undefined) {
  const repo = useRepository();
  return useQuery({
    queryKey: queryKeys.practice(id ?? ''),
    queryFn: () => repo.getPractice(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

/** Slots für 14 Tage ab heute (Berlin). */
export function usePracticeSlots(practiceId: string | undefined) {
  const repo = useRepository();
  const from = startOfBerlinDay(getNow());
  const fromKey = from.toISOString().slice(0, 10);
  return useQuery({
    queryKey: queryKeys.slots(practiceId ?? '', fromKey),
    queryFn: () => repo.getSlots(practiceId!, from, addDays(from, 14)),
    enabled: !!practiceId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Patcht einen geänderten Slot in alle passenden Caches (Realtime & optimistische UI). */
export function applySlotChange(client: QueryClient, slot: Slot) {
  client.setQueriesData<Slot[]>({ queryKey: queryKeys.slotsAll(slot.practiceId) }, (list) =>
    list ? list.map((s) => (s.id === slot.id ? { ...s, ...slot } : s)) : list,
  );
}

/**
 * Realtime: abonniert Slot-Änderungen für die Geohash-Zellen des sichtbaren Bereichs.
 * Slot-Listen werden direkt gepatcht, Suchergebnisse gebündelt neu geladen.
 */
export function useRealtimeSlots(cells: string[] | null) {
  const repo = useRepository();
  const client = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = cells ? [...cells].sort().join(',') : '';
  useEffect(() => {
    if (!key) return;
    const unsubscribe = repo.subscribeToCells(key.split(','), ({ slot }) => {
      applySlotChange(client, slot);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(
        () => void client.invalidateQueries({ queryKey: ['availability'] }),
        1200,
      );
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [client, key, repo]);
}

// ---------------------------------------------------------------------------
// Persönliche Daten
// ---------------------------------------------------------------------------

export function useSession() {
  const repo = useRepository();
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => repo.ensureSession(),
    staleTime: Infinity,
    retry: 1,
  });
}

export function useAppointments() {
  const repo = useRepository();
  return useQuery({ queryKey: queryKeys.appointments, queryFn: () => repo.listAppointments() });
}

export function useDependents() {
  const repo = useRepository();
  return useQuery({ queryKey: queryKeys.dependents, queryFn: () => repo.listDependents() });
}

export function useContact() {
  const repo = useRepository();
  return useQuery({ queryKey: queryKeys.contact, queryFn: () => repo.getContact() });
}

export function useWaitlist() {
  const repo = useRepository();
  return useQuery({ queryKey: queryKeys.waitlist, queryFn: () => repo.listWaitlist() });
}

export function useOffers() {
  const repo = useRepository();
  return useQuery({
    queryKey: queryKeys.offers,
    queryFn: () => repo.listOffers(),
    refetchInterval: 30_000,
  });
}

export function useConsents() {
  const repo = useRepository();
  return useQuery({ queryKey: queryKeys.consents, queryFn: () => repo.listConsents() });
}

export function useHasConsent(type: ConsentType, version?: string): boolean {
  const { data } = useConsents();
  return !!data?.some(
    (c) => c.type === type && !c.revokedAt && (!version || c.version === version),
  );
}

// ---------------------------------------------------------------------------
// Mutationen
// ---------------------------------------------------------------------------

function markSlot(client: QueryClient, slotId: string, status: Slot['status']) {
  client.setQueriesData<Slot[]>({ queryKey: ['slots'] }, (list) =>
    list ? list.map((s) => (s.id === slotId ? { ...s, status } : s)) : list,
  );
}

export function useHoldSlot() {
  const repo = useRepository();
  return useMutation({ mutationFn: (slotId: string) => repo.holdSlot(slotId) });
}

export function useReleaseHold() {
  const repo = useRepository();
  return useMutation({ mutationFn: (slotId: string) => repo.releaseHold(slotId) });
}

/** Buchen mit optimistischer UI: Slot sofort als gebucht markieren, bei Fehler zurückrollen. */
export function useBookSlot() {
  const repo = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: BookInput) => repo.bookSlot(input),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: ['slots'] });
      const snapshot = client.getQueriesData<Slot[]>({ queryKey: ['slots'] });
      markSlot(client, input.slotId, 'booked');
      return { snapshot };
    },
    onError: (_error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? []) client.setQueryData(key, data);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.appointments });
      void client.invalidateQueries({ queryKey: queryKeys.contact });
      void client.invalidateQueries({ queryKey: ['availability'] });
      void client.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}

export function useCancelAppointment() {
  const repo = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (appointment: Pick<Appointment, 'id' | 'slotId'>) =>
      repo.cancelAppointment(appointment.id),
    onMutate: async (appointment) => {
      await client.cancelQueries({ queryKey: queryKeys.appointments });
      const previous = client.getQueryData<AppointmentWithDetails[]>(queryKeys.appointments);
      client.setQueryData<AppointmentWithDetails[]>(queryKeys.appointments, (list) =>
        list?.map((a) =>
          a.id === appointment.id
            ? { ...a, status: 'cancelled', cancelledAt: new Date().toISOString() }
            : a,
        ),
      );
      return { previous };
    },
    onError: (_e, _a, context) => {
      if (context?.previous) client.setQueryData(queryKeys.appointments, context.previous);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.appointments });
      void client.invalidateQueries({ queryKey: ['availability'] });
      void client.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}

export function useRescheduleAppointment() {
  const repo = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { appointmentId: string; newSlotId: string; idempotencyKey: string }) =>
      repo.rescheduleAppointment(v.appointmentId, v.newSlotId, v.idempotencyKey),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.appointments });
      void client.invalidateQueries({ queryKey: ['slots'] });
      void client.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}

export function useJoinWaitlist() {
  const repo = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { input: WaitlistInput; center: LatLng }) =>
      repo.joinWaitlist(v.input, v.center),
    onSettled: () => void client.invalidateQueries({ queryKey: queryKeys.waitlist }),
  });
}

export function useLeaveWaitlist() {
  const repo = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => repo.leaveWaitlist(entryId),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.waitlist });
      void client.invalidateQueries({ queryKey: queryKeys.offers });
    },
  });
}

export function useRespondOffer() {
  const repo = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { offerId: string; accept: boolean; booking?: Omit<BookInput, 'slotId'> }) =>
      repo.respondOffer(v.offerId, v.accept, v.booking),
    onSettled: () => {
      for (const key of [queryKeys.offers, queryKeys.waitlist, queryKeys.appointments]) {
        void client.invalidateQueries({ queryKey: key });
      }
      void client.invalidateQueries({ queryKey: ['slots'] });
      void client.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}

export function useGrantConsent() {
  const repo = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { type: ConsentType; version: string }) => repo.grantConsent(v.type, v.version),
    onSettled: () => void client.invalidateQueries({ queryKey: queryKeys.consents }),
  });
}

export function useRevokeConsent() {
  const repo = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (type: ConsentType) => repo.revokeConsent(type),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.consents });
      void client.invalidateQueries({ queryKey: queryKeys.waitlist });
    },
  });
}

export function useAddDependent() {
  const repo = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { label: string; ageGroup: AgeGroup }) =>
      repo.addDependent(v.label, v.ageGroup),
    onSettled: () => void client.invalidateQueries({ queryKey: queryKeys.dependents }),
  });
}

export function useRemoveDependent() {
  const repo = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.removeDependent(id),
    onSettled: () => void client.invalidateQueries({ queryKey: queryKeys.dependents }),
  });
}

export function useVerifyEmail() {
  const repo = useRepository();
  const client = useQueryClient();
  return {
    request: useMutation({ mutationFn: (email: string) => repo.requestEmailCode(email) }),
    verify: useMutation({
      mutationFn: (v: { email: string; code: string }) => repo.verifyEmailCode(v.email, v.code),
      onSuccess: (session) => client.setQueryData(queryKeys.session, session),
    }),
  };
}

/** Praxen-Liste in Akut-Reihenfolge – nützlich für Home und Akut-Screen. */
export type RankedResult = PracticeAvailability;
