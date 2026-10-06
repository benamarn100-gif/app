import { forwardRef } from 'react';
import { View } from 'react-native';

import type { BBox } from '@/domain/geo/distance';
import type { LatLng, PracticeAvailability } from '@/domain/types';

export type PracticeMapHandle = { recenter: () => void; focus: (point: LatLng) => void };

type Props = {
  items: PracticeAvailability[];
  center: LatLng;
  radiusKm: number;
  selectedId: string | null;
  onSelect: (practiceId: string) => void;
  onRegionChange: (bbox: BBox) => void;
  bottomInset: number;
};

/** Web-Vorschau: keine native Karte – die Suche zeigt die gleichwertige Liste. */
export const PracticeMap = forwardRef<PracticeMapHandle, Props>(function PracticeMap() {
  return <View />;
});
