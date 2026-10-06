import type { LucideIcon } from 'lucide-react-native';

import type { ColorTokens } from '@/design/tokens';
import type { AvailabilityStatus } from '@/domain/types';

import { CircleAlert, CircleCheck, CircleQuestionMark, CircleX } from './icons';

/** Status wird nie nur über Farbe vermittelt: immer Icon + Text + Farbe. */
export const STATUS_VISUALS: Record<
  AvailabilityStatus,
  {
    icon: LucideIcon;
    fg: keyof ColorTokens;
    bg: keyof ColorTokens;
    labelKey: `status.${AvailabilityStatus}`;
  }
> = {
  free: { icon: CircleCheck, fg: 'statusFree', bg: 'statusFreeSoft', labelKey: 'status.free' },
  few: { icon: CircleAlert, fg: 'statusFew', bg: 'statusFewSoft', labelKey: 'status.few' },
  booked: { icon: CircleX, fg: 'statusBooked', bg: 'statusBookedSoft', labelKey: 'status.booked' },
  unknown: {
    icon: CircleQuestionMark,
    fg: 'statusUnknown',
    bg: 'statusUnknownSoft',
    labelKey: 'status.unknown',
  },
};
