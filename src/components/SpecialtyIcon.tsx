import type { LucideIcon, LucideProps } from 'lucide-react-native';

import {
  Baby,
  Bone,
  Brain,
  Droplet,
  Ear,
  Eye,
  Hand,
  HeartPulse,
  MessageCircleHeart,
  Stethoscope,
  Toothbrush,
  Venus,
} from '@/components/icons';
import type { SpecialtySlug } from '@/domain/types';

export const SPECIALTY_ICONS: Record<SpecialtySlug, LucideIcon> = {
  allgemeinmedizin: Stethoscope,
  'innere-medizin': HeartPulse,
  'kinder-jugendmedizin': Baby,
  frauenheilkunde: Venus,
  hno: Ear,
  augenheilkunde: Eye,
  dermatologie: Hand,
  orthopaedie: Bone,
  zahnmedizin: Toothbrush,
  neurologie: Brain,
  urologie: Droplet,
  'psychiatrie-psychotherapie': MessageCircleHeart,
};

export function SpecialtyIcon({ slug, ...props }: LucideProps & { slug: SpecialtySlug }) {
  const Icon = SPECIALTY_ICONS[slug] ?? Stethoscope;
  return <Icon strokeWidth={2} {...props} />;
}
