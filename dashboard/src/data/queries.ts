import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';

import type { Practice } from '@app/domain/types';

import { addBerlinDays, startOfBerlinDay } from '../lib/time';
import { useRepository } from './RepositoryContext';
import { DashboardError, type LiveEvent, type NewSlotInput, type NewTemplateInput } from './types';

export type BookingRange = 'today' | 'week' | 'month';
export const BOOKING_RANGE_DAYS: Record<BookingRange, number> = { today: 1, week: 7, month: 30 };

export const keys = {
  auth: ['auth'] as const,
  practices: ['practices'] as const,
  week: (practiceId: string, from: string) => ['week', practiceId, from] as const,
  today: (practiceId: string) => ['today', practiceId] as const,
  bookings: (practiceId: string, range: BookingRange) => ['bookings', practiceId, range] as const,
  templates: (practiceId: string) => ['templates', practiceId] as const,
};

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Fachliche Fehler (kein Zugang, ungültig) nicht wiederholen
        retry: (count, error) =>
          !(error instanceof DashboardError && error.code !== 'network') && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

export function useAuthState() {
  const repo = useRepository();
  const client = useQueryClient();
  useEffect(
    () => repo.auth.onChange(() => void client.invalidateQueries({ queryKey: keys.auth })),
    [client, repo],
  );
  return useQuery({ queryKey: keys.auth, queryFn: () => repo.auth.current(), staleTime: Infinity });
}

export function usePractices(enabled: boolean) {
  const repo = useRepository();
  return useQuery({ queryKey: keys.practices, queryFn: () => repo.myPractices(), enabled });
}

export function useWeek(practiceId: string, weekStart: Date) {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.week(practiceId, weekStart.toISOString()),
    queryFn: () => repo.week(practiceId, weekStart, addBerlinDays(weekStart, 7)),
    placeholderData: (previous) => previous,
  });
}

/** Heutige Slots für die Anzeige „So sieht die App Sie heute“. */
export function useToday(practiceId: string) {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.today(practiceId),
    queryFn: () => {
      const start = startOfBerlinDay(new Date());
      return repo.week(practiceId, start, addBerlinDays(start, 1));
    },
    refetchInterval: 60_000,
  });
}

export function useBookings(practiceId: string, range: BookingRange) {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.bookings(practiceId, range),
    queryFn: () => {
      const start = startOfBerlinDay(new Date());
      return repo.bookings(practiceId, start, addBerlinDays(start, BOOKING_RANGE_DAYS[range]));
    },
    // Patientendaten nicht länger als nötig im Speicher halten
    gcTime: 60_000,
  });
}

export function useTemplates(practiceId: string) {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.templates(practiceId),
    queryFn: () => repo.templates(practiceId),
  });
}

function useInvalidate(practiceId: string) {
  const client = useQueryClient();
  return (...roots: string[]) =>
    Promise.all(
      roots.map((root) => client.invalidateQueries({ queryKey: [root, practiceId] as QueryKey })),
    );
}

export function useCreateSlot(practiceId: string) {
  const repo = useRepository();
  const invalidate = useInvalidate(practiceId);
  return useMutation({
    mutationFn: (input: NewSlotInput) => repo.createSlot(practiceId, input),
    onSuccess: () => invalidate('week', 'today'),
  });
}

export function useCancelSlot(practiceId: string) {
  const repo = useRepository();
  const invalidate = useInvalidate(practiceId);
  return useMutation({
    mutationFn: (slotId: string) => repo.cancelSlot(practiceId, slotId),
    onSettled: () => invalidate('week', 'today'),
  });
}

export function useCancelAppointment(practiceId: string) {
  const repo = useRepository();
  const invalidate = useInvalidate(practiceId);
  return useMutation({
    mutationFn: (appointmentId: string) => repo.cancelAppointment(practiceId, appointmentId),
    onSettled: () => invalidate('bookings', 'week', 'today'),
  });
}

export function useAddTemplate(practiceId: string) {
  const repo = useRepository();
  const invalidate = useInvalidate(practiceId);
  return useMutation({
    mutationFn: (input: NewTemplateInput) => repo.addTemplate(practiceId, input),
    onSuccess: () => invalidate('templates'),
  });
}

export function useDeleteTemplate(practiceId: string) {
  const repo = useRepository();
  const invalidate = useInvalidate(practiceId);
  return useMutation({
    mutationFn: (templateId: string) => repo.deleteTemplate(practiceId, templateId),
    onSettled: () => invalidate('templates'),
  });
}

export function useApplyTemplates(practiceId: string) {
  const repo = useRepository();
  const invalidate = useInvalidate(practiceId);
  return useMutation({
    mutationFn: ({ fromDate, weeks }: { fromDate: string; weeks: number }) =>
      repo.applyTemplates(practiceId, fromDate, weeks),
    onSuccess: () => invalidate('week', 'today'),
  });
}

export function useConfirmAvailability(practiceId: string) {
  const repo = useRepository();
  const invalidate = useInvalidate(practiceId);
  return useMutation({
    mutationFn: () => repo.confirmAvailability(practiceId),
    onSuccess: () => invalidate('week', 'today'),
  });
}

/** Realtime: Slot-Änderungen der Praxis → Daten neu laden; neue Buchung melden. */
export function useLiveUpdates(practice: Practice, onEvent: (event: LiveEvent) => void) {
  const repo = useRepository();
  const invalidate = useInvalidate(practice.id);
  const handle = useEffectEvent((event: LiveEvent) => {
    void invalidate('week', 'today', 'bookings');
    onEvent(event);
  });
  useEffect(() => repo.subscribe(practice, (event) => handle(event)), [repo, practice]);
}
