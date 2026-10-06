import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type Ref,
} from 'react';
import { View } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { List, LocateFixed, Map as MapIcon, SlidersHorizontal } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BottomSheet,
  Card,
  EmptyState,
  IllustrationOffline,
  IllustrationSearchEmpty,
  OfflineBanner,
  PracticeCard,
  PressableScale,
  SearchField,
  SegmentedControl,
  SkeletonList,
  Stagger,
  Text,
  type BottomSheetRef,
} from '@/components';
import { useAvailabilitySearch, useRealtimeSlots } from '@/data/hooks';
import { makeStyles, useTheme } from '@/design/theme';
import { destinationPoint, type BBox } from '@/domain/geo/distance';
import { geohashesForBBox } from '@/domain/geo/geohash';
import type { LatLng, PracticeAvailability } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { activeFilterCount, nextRadius, useSearchFilters } from '@/state/searchFilters';

import { isMapAvailable } from './map/mapAvailability';
import type { PracticeMapHandle } from './map/PracticeMap';
import { useFilteredSearchParams } from './useSearchParams';

type MapProps = {
  ref?: Ref<PracticeMapHandle>;
  items: PracticeAvailability[];
  center: LatLng;
  radiusKm: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRegionChange: (bbox: BBox) => void;
  bottomInset: number;
};

// Karte nur laden, wo nativer Code vorhanden ist (nicht in Expo Go / Web).
const MapComponent: ComponentType<MapProps> | null = isMapAvailable()
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- bewusst bedingt geladen
    (require('./map/PracticeMap') as { PracticeMap: ComponentType<MapProps> }).PracticeMap
  : null;

function bboxAround(center: LatLng, radiusKm: number): BBox {
  const n = destinationPoint(center, radiusKm * 1000, 0);
  const e = destinationPoint(center, radiusKm * 1000, 90);
  const s = destinationPoint(center, radiusKm * 1000, 180);
  const w = destinationPoint(center, radiusKm * 1000, 270);
  return { minLat: s.lat, maxLat: n.lat, minLng: w.lng, maxLng: e.lng };
}

export function SearchScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const params = useLocalSearchParams<{ view?: string }>();
  const filters = useSearchFilters();
  const [text, setText] = useState(filters.text);
  const [view, setView] = useState<'map' | 'list'>(
    MapComponent && params.view !== 'list' ? 'map' : 'list',
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [region, setRegion] = useState<BBox | null>(null);
  const mapRef = useRef<PracticeMapHandle>(null);
  const sheetRef = useRef<BottomSheetRef>(null);

  // Ansicht folgt dem Parameter (z. B. „Karte öffnen“ auf der Startseite) – ohne Effect
  const [viewParam, setViewParam] = useState(params.view);
  if (params.view !== viewParam) {
    setViewParam(params.view);
    if (params.view === 'map' && MapComponent) setView('map');
  }

  // Suchtext entprellen
  useEffect(() => {
    const id = setTimeout(() => filters.set({ text }), 250);
    return () => clearTimeout(id);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const { params: searchParams, center } = useFilteredSearchParams();
  const query = useAvailabilitySearch(searchParams);
  const items = useMemo(() => query.data ?? [], [query.data]);
  const filterCount = activeFilterCount(filters);

  // Realtime: Zellen des sichtbaren Bereichs (Karte) bzw. des Umkreises (Liste)
  const cells = useMemo(() => {
    const box =
      view === 'map' && region
        ? region
        : center.center
          ? bboxAround(center.center, filters.radiusKm)
          : null;
    return box ? geohashesForBBox(box) : null;
  }, [view, region, center.center, filters.radiusKm]);
  useRealtimeSlots(cells);

  const selected = selectedId ? items.find((i) => i.practice.id === selectedId) : undefined;
  const listItems = useMemo(
    () =>
      selected ? [selected, ...items.filter((i) => i.practice.id !== selected.practice.id)] : items,
    [items, selected],
  );
  const openPractice = useCallback((id: string) => router.push(`/practice/${id}`), []);
  const next = nextRadius(filters.radiusKm);

  const toolbar = (
    <View style={styles.toolbar}>
      <SearchField
        value={text}
        onChangeText={setText}
        label={t('search.placeholder')}
        placeholder={t('search.placeholder')}
        testID="search-input"
      />
      <View style={styles.toolbarRow}>
        <PressableScale
          onPress={() => router.push('/filters')}
          accessibilityRole="button"
          accessibilityLabel={
            filterCount ? t('search.filtersActive', { count: filterCount }) : t('search.filters')
          }
          style={[styles.filterButton, filterCount > 0 && styles.filterActive]}
          testID="open-filters"
        >
          <SlidersHorizontal size={18} color={theme.colors.primary} strokeWidth={2.25} />
          <Text variant="smallStrong" color="primary">
            {filterCount ? `${t('search.filters')} · ${filterCount}` : t('search.filters')}
          </Text>
        </PressableScale>
        {MapComponent ? (
          <View style={styles.toggle}>
            <SegmentedControl
              accessibilityLabel={t('search.viewToggleA11y')}
              value={view}
              onChange={setView}
              options={[
                { value: 'map', label: t('search.map'), icon: MapIcon },
                { value: 'list', label: t('search.list'), icon: List },
              ]}
              testID="view-toggle"
            />
          </View>
        ) : null}
      </View>
    </View>
  );

  const empty = query.isLoading ? (
    <SkeletonList count={3} />
  ) : query.isError && !query.data ? (
    <EmptyState
      tone="error"
      illustration={<IllustrationOffline size={130} />}
      title={t('errors.loadPractices')}
      body={t('errors.network')}
      primaryAction={{ label: t('common.retry'), onPress: () => void query.refetch() }}
    />
  ) : !center.center ? (
    <EmptyState
      illustration={<IllustrationSearchEmpty size={130} />}
      title={t('empty.noLocation')}
      body={t('empty.noLocationBody')}
      primaryAction={{ label: t('empty.setLocation'), onPress: () => router.push('/location') }}
    />
  ) : (
    <EmptyState
      illustration={<IllustrationSearchEmpty size={130} />}
      title={
        filterCount || filters.text
          ? t('empty.noResults')
          : t('empty.radius', { radius: filters.radiusKm })
      }
      primaryAction={
        filterCount || filters.text
          ? {
              label: t('empty.resetFilters'),
              onPress: () => {
                setText('');
                filters.reset(filters.radiusKm);
              },
            }
          : next
            ? {
                label: t('empty.radiusAction', { radius: next }),
                onPress: () => filters.set({ radiusKm: next }),
              }
            : undefined
      }
      secondaryAction={{
        label: t('empty.waitlistAction'),
        onPress: () => router.push('/waitlist/any'),
      }}
      testID="search-empty"
    />
  );

  const resultHeader = (
    <View style={styles.resultHeader}>
      <Text variant="h3">{t('search.sheetTitle')}</Text>
      {!query.isLoading && items.length > 0 ? (
        <Text
          variant="smallStrong"
          color="textSecondary"
          accessibilityLiveRegion="polite"
          testID="result-count"
        >
          {t('search.resultCount', { count: items.length })}
        </Text>
      ) : null}
      {center.demoFallback ? (
        <Text variant="small" color="textSecondary">
          {t('app.demoNotice')}
        </Text>
      ) : null}
    </View>
  );

  const renderCard = ({ item, index }: { item: PracticeAvailability; index: number }) => (
    <Stagger index={index}>
      <View style={styles.cardWrap}>
        <PracticeCard item={item} onPress={openPractice} testID={`search-result-${index}`} />
      </View>
    </Stagger>
  );

  if (view === 'map' && MapComponent && center.center) {
    const sheetInset = 220;
    return (
      <View style={styles.root} testID="search-map-view">
        <MapComponent
          ref={mapRef}
          items={items}
          center={center.center}
          radiusKm={filters.radiusKm}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            sheetRef.current?.snapToIndex(1);
          }}
          onRegionChange={setRegion}
          bottomInset={sheetInset}
        />
        <View style={[styles.mapOverlay, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <Card padding="md" style={styles.overlayCard}>
            {toolbar}
          </Card>
          <OfflineBanner />
          <PressableScale
            onPress={() => mapRef.current?.recenter()}
            accessibilityRole="button"
            accessibilityLabel={t('search.locateMe')}
            style={styles.locate}
          >
            <LocateFixed size={22} color={theme.colors.primary} strokeWidth={2.25} />
          </PressableScale>
        </View>
        <BottomSheet ref={sheetRef} index={0} accessibilityLabel={t('search.sheetTitle')}>
          <BottomSheetFlatList
            data={listItems}
            keyExtractor={(item: PracticeAvailability) => item.practice.id}
            renderItem={renderCard}
            ListHeaderComponent={resultHeader}
            ListEmptyComponent={empty}
            contentContainerStyle={[styles.sheetList, { paddingBottom: insets.bottom + 96 }]}
          />
        </BottomSheet>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]} testID="search-list-view">
      <FlashList
        data={query.isLoading ? [] : items}
        keyExtractor={(item) => item.practice.id}
        renderItem={renderCard}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {toolbar}
            <OfflineBanner />
            {!MapComponent ? (
              <Text variant="small" color="textSecondary">
                {t('search.mapUnavailable')}
              </Text>
            ) : null}
            {resultHeader}
          </View>
        }
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  toolbar: { gap: t.space.sm },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm, flexWrap: 'wrap' },
  toggle: { flex: 1, minWidth: 180 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    minHeight: t.layout.touchTarget,
    paddingHorizontal: t.space.md,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surface,
  },
  filterActive: { borderColor: t.colors.primary, backgroundColor: t.colors.primarySoft },
  mapOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: t.space.md,
    gap: t.space.xs,
  },
  overlayCard: { boxShadow: t.shadows.lg },
  locate: {
    alignSelf: 'flex-end',
    width: t.layout.touchTarget,
    height: t.layout.touchTarget,
    borderRadius: t.layout.touchTarget / 2,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: t.shadows.md,
  },
  sheetList: { paddingHorizontal: t.space.md, gap: t.space.sm },
  resultHeader: { gap: t.space.xxs, paddingBottom: t.space.sm },
  listHeader: { gap: t.space.md, paddingBottom: t.space.sm },
  cardWrap: { paddingBottom: t.space.sm },
}));
