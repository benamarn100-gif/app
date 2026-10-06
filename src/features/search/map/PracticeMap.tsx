import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map,
  type CameraRef,
  type GeoJSONSourceRef,
} from '@maplibre/maplibre-react-native';

import { env } from '@/config/env';
import { useTheme } from '@/design/theme';
import type { BBox } from '@/domain/geo/distance';
import { formatBerlinTime } from '@/domain/time/berlin';
import type { LatLng, PracticeAvailability } from '@/domain/types';
import { useT } from '@/i18n/useT';

import { zoomForRadius } from './mapAvailability';

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

const PIN_IMAGES = {
  light: {
    'pin-free': require('../../../../assets/map/pin-free-light.png'),
    'pin-few': require('../../../../assets/map/pin-few-light.png'),
    'pin-booked': require('../../../../assets/map/pin-booked-light.png'),
    'pin-unknown': require('../../../../assets/map/pin-unknown-light.png'),
  },
  dark: {
    'pin-free': require('../../../../assets/map/pin-free-dark.png'),
    'pin-few': require('../../../../assets/map/pin-few-dark.png'),
    'pin-booked': require('../../../../assets/map/pin-booked-dark.png'),
    'pin-unknown': require('../../../../assets/map/pin-unknown-dark.png'),
  },
};

/**
 * Vollflächige Karte (MapLibre, OSM-Vektorkacheln) mit Clustering.
 * Pins: Farbe + Symbol + nächste Uhrzeit. Gleichwertige Liste liegt im Bottom Sheet.
 */
export const PracticeMap = forwardRef<PracticeMapHandle, Props>(function PracticeMap(
  { items, center, radiusKm, selectedId, onSelect, onRegionChange, bottomInset },
  ref,
) {
  const theme = useTheme();
  const { t, locale } = useT();
  const camera = useRef<CameraRef>(null);
  const source = useRef<GeoJSONSourceRef>(null);

  useImperativeHandle(ref, () => ({
    recenter: () =>
      camera.current?.easeTo({
        center: [center.lng, center.lat],
        zoom: zoomForRadius(radiusKm),
        duration: 400,
      }),
    focus: (p) => camera.current?.easeTo({ center: [p.lng, p.lat], zoom: 14, duration: 400 }),
  }));

  const data = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: items.map((item) => ({
        type: 'Feature',
        id: item.practice.id,
        geometry: {
          type: 'Point',
          coordinates: [item.practice.location.lng, item.practice.location.lat],
        },
        properties: {
          id: item.practice.id,
          status: item.status,
          label: item.nextSlot
            ? formatBerlinTime(item.nextSlot.startsAt, locale)
            : t(`status.${item.status}`),
        },
      })),
    }),
    [items, locale, t],
  );

  const centerData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [center.lng, center.lat] },
          properties: {},
        },
      ],
    }),
    [center],
  );

  return (
    <View
      style={StyleSheet.absoluteFill}
      accessible
      accessibilityLabel={t('search.mapA11y', { count: items.length })}
      testID="practice-map"
    >
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={env.mapStyleUrl}
        attribution
        attributionPosition={{ bottom: bottomInset + 8, right: 8 }}
        logo={false}
        compass={false}
        contentInset={{ top: 120, bottom: bottomInset, left: 0, right: 0 }}
        onRegionDidChange={(e) => {
          const [w, s, east, n] = e.nativeEvent.bounds;
          onRegionChange({ minLng: w, minLat: s, maxLng: east, maxLat: n });
        }}
        onPress={async (e) => {
          const features = 'features' in e.nativeEvent ? e.nativeEvent.features : [];
          const hit = features[0];
          if (!hit) return;
          const props = hit.properties as {
            cluster?: boolean;
            cluster_id?: number;
            id?: string;
          } | null;
          if (props?.cluster && props.cluster_id != null && hit.geometry.type === 'Point') {
            const zoom = await source.current?.getClusterExpansionZoom(props.cluster_id);
            const [lng, lat] = hit.geometry.coordinates as [number, number];
            camera.current?.easeTo({ center: [lng, lat], zoom: zoom ?? 13, duration: 350 });
          } else if (props?.id) {
            onSelect(props.id);
          }
        }}
      >
        <Camera
          ref={camera}
          initialViewState={{ center: [center.lng, center.lat], zoom: zoomForRadius(radiusKm) }}
        />
        <Images images={PIN_IMAGES[theme.scheme]} />
        <GeoJSONSource id="search-center" data={centerData}>
          <Layer
            id="search-center-dot"
            type="circle"
            paint={{
              'circle-radius': 8,
              'circle-color': theme.colors.primary,
              'circle-stroke-width': 3,
              'circle-stroke-color': theme.colors.surface,
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource
          ref={source}
          id="practices"
          data={data}
          cluster
          clusterRadius={44}
          clusterMaxZoom={13}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': theme.colors.primary,
              'circle-radius': ['step', ['get', 'point_count'], 18, 5, 22, 15, 28],
              'circle-stroke-width': 3,
              'circle-stroke-color': theme.colors.surface,
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': ['Noto Sans Bold'],
              'text-size': 14,
              'text-allow-overlap': true,
            }}
            paint={{ 'text-color': theme.colors.textOnPrimary }}
          />
          <Layer
            id="pins"
            type="symbol"
            filter={['!', ['has', 'point_count']]}
            layout={{
              'icon-image': ['concat', 'pin-', ['get', 'status']],
              'icon-size': ['case', ['==', ['get', 'id'], selectedId ?? ''], 0.78, 0.56],
              'icon-allow-overlap': true,
              'text-field': ['get', 'label'],
              'text-font': ['Noto Sans Bold'],
              'text-size': 12,
              'text-offset': [0, 1.7],
              'text-anchor': 'top',
              'text-optional': true,
            }}
            paint={{
              'text-color': theme.colors.textPrimary,
              'text-halo-color': theme.colors.surface,
              'text-halo-width': 1.5,
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
});
