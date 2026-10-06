import { AcuteScreen } from '@/features/acute/AcuteScreen';

/**
 * Tab „Heute“ (Feature 2): Praxen mit freiem Termin in den nächsten 24 Stunden.
 * Nutzen: Wer schnell einen Arzt braucht, ist mit einem Tipp in der passenden Liste –
 * auch abends, wenn „heute“ schon vorbei ist.
 */
export default function TodayTab() {
  return <AcuteScreen variant="tab" />;
}
